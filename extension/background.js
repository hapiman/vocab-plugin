// Background Service Worker
// 负责：DeepSeek API 调用、存储管理、Gist 同步

// ── 串行写队列：防止并发 read-modify-write 互相覆盖 ─────────────────────────

const writeQueue = [];
let writeRunning = false;

function serialWrite(fn) {
  return new Promise((resolve, reject) => {
    writeQueue.push({ fn, resolve, reject });
    if (!writeRunning) drainWriteQueue();
  });
}

async function drainWriteQueue() {
  if (writeQueue.length === 0) { writeRunning = false; return; }
  writeRunning = true;
  const { fn, resolve, reject } = writeQueue.shift();
  try { resolve(await fn()); }
  catch (e) { reject(e); }
  drainWriteQueue();
}

// ── Gist 同步 ──────────────────────────────────────────────────────────────

const GIST_SYNC_ALARM = 'gist-sync';

// 用 chrome.alarms 做 5 秒防抖：alarms 能跨 MV3 service worker 回收存活，
// 避免保存单词后 worker 被回收、setTimeout 随之丢失导致同步从不触发。
function scheduleGistSync() {
  // 重复 create 同名 alarm 会覆盖上一个，天然实现防抖。
  chrome.alarms.create(GIST_SYNC_ALARM, { when: Date.now() + 5000 });
}


chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === GIST_SYNC_ALARM) syncToGist();
});

// 记录最近一次同步结果，供设置页 / popup 读取展示。
async function recordSyncState(state) {
  await chrome.storage.local.set({
    lastSyncState: { ...state, at: new Date().toISOString() }
  });
}

// 在 GitHub 创建一个新的私有 Gist，写回 gistId。
async function createGist(githubToken, content) {
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Vocab Learner - 个人词库',
      public: false,
      files: { 'vocab-learner.json': { content } }
    })
  });
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  await chrome.storage.local.set({ gistId: data.id });
  return data.id;
}

async function syncToGist() {
  const { githubToken, gistId, words } = await chrome.storage.local.get(['githubToken', 'gistId', 'words']);
  if (!githubToken) return { ok: false, error: 'missing github token' };

  const content = JSON.stringify(words || {}, null, 2);

  try {
    let created = false;

    if (gistId) {
      // 更新已有 Gist
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: { 'vocab-learner.json': { content } }
        })
      });

      if (res.status === 404 || res.status === 422) {
        // 远端 gist 已被删除 / 无法访问 → 清掉失效 id，回退到创建分支。
        await chrome.storage.local.remove('gistId');
        await createGist(githubToken, content);
        created = true;
      } else if (res.status === 401 || res.status === 403) {
        // token 无效或缺少 gist 权限 → 重建也会失败，如实报错。
        const err = new Error(`GitHub API ${res.status}`);
        err.status = res.status;
        throw err;
      } else if (!res.ok) {
        const err = new Error(`GitHub API ${res.status}`);
        err.status = res.status;
        throw err;
      }
    } else {
      // 本地没有 gistId → 创建新 Gist
      await createGist(githubToken, content);
      created = true;
    }

    const lastGistSync = new Date().toISOString();
    await chrome.storage.local.set({ lastGistSync });
    await recordSyncState({ ok: true, created, code: created ? 'created' : 'updated', lastGistSync });
    return { ok: true, created };
  } catch (e) {
    console.error('Gist sync failed:', e);
    const code = (e.status === 401 || e.status === 403) ? 'forbidden' : 'error';
    const error = code === 'forbidden'
      ? 'GitHub Token 无效或缺少 gist 权限'
      : e.message;
    await recordSyncState({ ok: false, code, error });
    return { ok: false, code, error };
  }
}

function statsFromWords(wordMap) {
  const map = wordMap || {};
  const learning = Object.values(map).filter(w => w.status === 'learning').length;
  const mastered = Object.values(map).filter(w => w.status === 'mastered').length;
  return { learning, mastered, total: learning + mastered, reviewDue: reviewDueCount(map) };
}

function mergeContexts(remoteContexts, localContexts) {
  const result = Array.isArray(remoteContexts) ? [...remoteContexts] : [];
  const seen = new Set(result.map(c => `${c?.sentence || ''}\n${c?.url || ''}`));

  for (const context of Array.isArray(localContexts) ? localContexts : []) {
    const key = `${context?.sentence || ''}\n${context?.url || ''}`;
    if (!seen.has(key)) {
      result.push(context);
      seen.add(key);
    }
  }

  return result.slice(-5);
}

function mergePulledWords(remoteWords, localWords) {
  const merged = { ...(remoteWords || {}) };

  for (const [word, localInfo] of Object.entries(localWords || {})) {
    const remoteInfo = merged[word];
    if (!remoteInfo) {
      merged[word] = localInfo;
      continue;
    }

    // 远端可能包含 iOS 刚写入的复习字段；本地只补充浏览器端可能新增的释义和例句。
    merged[word] = {
      ...remoteInfo,
      firstSeen: remoteInfo.firstSeen || localInfo.firstSeen,
      contexts: mergeContexts(remoteInfo.contexts, localInfo.contexts),
      definition: remoteInfo.definition || localInfo.definition || '',
      phonetic: remoteInfo.phonetic || localInfo.phonetic || '',
    };
  }

  return merged;
}

async function pullFromGist(options = {}) {
  const { preserveLocal = true } = options;
  const { githubToken, gistId, words: localWords } = await chrome.storage.local.get(['githubToken', 'gistId', 'words']);

  if (!githubToken) {
    return { ok: false, code: 'no-token', error: '请先在设置页填写 GitHub Token', stats: statsFromWords(localWords) };
  }

  // 本地无 gistId（新账号）或远端 404（已删除）→ 自动创建新 Gist。
  let needCreate = !gistId;

  try {
    if (!needCreate) {
      const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Cache-Control': 'no-cache',
        }
      });

      if (res.status === 404) {
        await chrome.storage.local.remove('gistId');
        needCreate = true;
      } else {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `GitHub API ${res.status}`);

        const content = data.files?.['vocab-learner.json']?.content;
        if (!content) {
          return { ok: false, code: 'no-file', error: 'Gist 中没有 vocab-learner.json', stats: statsFromWords(localWords) };
        }

        const remoteWords = JSON.parse(content);
        const words = preserveLocal ? mergePulledWords(remoteWords, localWords || {}) : remoteWords;
        const lastGistSync = new Date().toISOString();
        await chrome.storage.local.set({ words, lastGistSync });
        await recordSyncState({ ok: true, code: 'pulled', lastGistSync });
        updateBadge(words);
        return { ok: true, code: 'pulled', stats: statsFromWords(words), lastGistSync };
      }
    }

    // 走到这里说明需要创建新 Gist。
    const newId = await createGist(githubToken, JSON.stringify(localWords || {}, null, 2));
    const lastGistSync = new Date().toISOString();
    await chrome.storage.local.set({ lastGistSync });
    await recordSyncState({ ok: true, created: true, code: 'created', lastGistSync });
    return { ok: true, created: true, code: 'created', gistId: newId, stats: statsFromWords(localWords), lastGistSync };
  } catch (e) {
    console.error('Gist pull failed:', e);
    const forbidden = e.status === 401 || e.status === 403;
    const code = forbidden ? 'forbidden' : 'error';
    const error = forbidden ? 'GitHub Token 无效或缺少 gist 权限' : e.message;
    await recordSyncState({ ok: false, code, error });
    return { ok: false, code: 'error', error: e.message, stats: statsFromWords(localWords) };
  }
}

// ── DeepSeek API ───────────────────────────────────────────────────────────

async function callDeepSeek(messages, maxTokens) {
  const { deepseekApiKey } = await chrome.storage.local.get('deepseekApiKey');
  if (!deepseekApiKey) {
    return { error: '请先在设置页填入 DeepSeek API Key' };
  }

  let res;
  try {
    res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: maxTokens,
        messages,
      })
    });
  } catch (e) {
    console.error('[VocabLearner] fetch failed:', e);
    return { error: `网络请求失败: ${e.message}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[VocabLearner] API error:', res.status, body);
    if (res.status === 401) return { error: 'API Key 无效，请在设置页重新填入' };
    if (res.status === 429) return { error: '请求过于频繁，稍后再试' };
    return { error: `API 返回错误 ${res.status}` };
  }

  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '' };
}

async function getDefinition(word, context) {
  const { deepseekApiKey } = await chrome.storage.local.get('deepseekApiKey');
  if (!deepseekApiKey) {
    return { error: '请先在设置页填入 DeepSeek API Key' };
  }

  const contextLine = context
    ? `该词出现在以下句子中：\n"${context}"\n请结合此句意思给出最贴切的释义。\n`
    : '';

  const result = await callDeepSeek([{
    role: 'user',
    content: `你是英文词典助手。${contextLine}请为单词 "${word}" 返回 JSON，格式如下，除 JSON 外不要输出任何其他内容：
{"phonetic":"/音标/","definition":"词性+结合语境的中文释义","example":"直接引用或改写上面的例句"}`
  }], 300);

  if (result.error) return result;

  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[VocabLearner] JSON parse failed, raw text:', result.text);
    return { phonetic: '', definition: result.text.slice(0, 100), example: '' };
  }
}

// ── 翻译 ───────────────────────────────────────────────────────────────────

async function translateText(text, context) {
  const { deepseekApiKey } = await chrome.storage.local.get('deepseekApiKey');
  if (!deepseekApiKey) return { error: '请先填入 DeepSeek API Key' };

  const contextLine = context ? `上下文参考（仅用于理解语境，不需要翻译）：\n"${context}"\n\n` : '';
  const isLong = text.split(/\s+/).length >= 5;

  const prompt = isLong
    ? `${contextLine}请将以下英文翻译成中文，要求：
1. 译文自然流畅，符合中文表达习惯，不要逐字直译
2. 专有名词、产品名、品牌名保留英文原文
3. 技术术语优先使用业界通行译法
4. 只返回 JSON，不要 markdown 代码块：
{"translation":"译文","phrases":[{"en":"值得注意的短语或术语（直接摘自原句）","zh":"简短解释"}]}
phrases 只收录 3~5 个对理解句意有帮助的关键短语或术语，不需要翻译每个词。

原文："${text}"`
    : `${contextLine}将以下英文翻译成自然流畅的中文，只输出译文，不加任何解释：\n"${text}"`;

  const result = await callDeepSeek([{ role: 'user', content: prompt }], 600);

  if (result.error) return result;

  if (isLong) {
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error();
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { translation: result.text, phrases: [] };
    }
  }
  return { translation: result.text.trim(), phrases: [] };
}

// ── 存储操作 ───────────────────────────────────────────────────────────────

// 释义临时缓存：GET_DEFINITION 返回时单词可能还没被 MARK_WORD 存入 storage
// key: word, value: { definition, phonetic }
const pendingDefs = new Map();

async function getInitData() {
  const { words } = await chrome.storage.local.get('words');
  return { wordStatus: words || {} };
}

function nowMinute() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function addDays(date, days) {
  return addMinutes(date, days * 24 * 60);
}

function ensureReviewFields(info) {
  if (!info || info.status !== 'learning') return info;
  info.reviewCount = Number(info.reviewCount || 0);
  info.correctCount = Number(info.correctCount || 0);
  info.missCount = Number(info.missCount || 0);
  info.intervalDays = Number(info.intervalDays || 0);
  if (!info.dueAt) info.dueAt = new Date().toISOString();
  return info;
}

function reviewDueCount(wordMap) {
  const now = Date.now();
  return Object.values(wordMap || {}).filter(w => {
    if (w.status !== 'learning') return false;
    if (!w.dueAt) return true;
    const due = Date.parse(w.dueAt);
    return Number.isNaN(due) || due <= now;
  }).length;
}

function updateBadge(wordMap) {
  const learningCount = Object.values(wordMap || {}).filter(w => w.status === 'learning').length;
  chrome.action.setBadgeText({ text: learningCount > 0 ? String(learningCount) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
}

function nextGoodIntervalDays(correctCount) {
  const intervals = [1, 3, 7, 14, 30, 60, 120];
  return intervals[Math.min(Math.max(correctCount - 1, 0), intervals.length - 1)];
}

async function markWord(word, status, context) {
  const wordMap = await serialWrite(async () => {
    const { words } = await chrome.storage.local.get('words');
    const map = words || {};

    if (!map[word]) {
      const pending = pendingDefs.get(word);
      pendingDefs.delete(word);
      map[word] = {
        status,
        firstSeen: nowMinute(),
        lastSeen: nowMinute(),
        contexts: [],
        definition: pending?.definition || '',
        phonetic: pending?.phonetic || '',
      };
    } else {
      const wasStatus = map[word].status;
      map[word].status = status;
      map[word].lastSeen = nowMinute();
      if (status === 'learning' && wasStatus !== 'learning') {
        map[word].dueAt = new Date().toISOString();
      }
    }

    ensureReviewFields(map[word]);
    if (!Array.isArray(map[word].contexts)) map[word].contexts = [];

    if (context && map[word].contexts.length < 5) {
      const exists = map[word].contexts.some(c => c.sentence === context.sentence);
      if (!exists) map[word].contexts.push(context);
    }

    await chrome.storage.local.set({ words: map });
    return map;
  });

  scheduleGistSync();
  updateBadge(wordMap);
}

async function saveDefinition(word, def) {
  return serialWrite(async () => {
    const { words } = await chrome.storage.local.get('words');
    if (!words?.[word]) return false;
    words[word].definition = def.definition || '';
    words[word].phonetic = def.phonetic || '';
    await chrome.storage.local.set({ words });
    return true;
  });
}

async function reviewWord(word, outcome) {
  const allowedOutcomes = new Set(['miss', 'hard', 'good', 'skip', 'mastered']);
  if (!allowedOutcomes.has(outcome)) {
    return { ok: false, error: 'invalid outcome' };
  }

  const result = await serialWrite(async () => {
    const { words } = await chrome.storage.local.get('words');
    const wordMap = words || {};
    const info = wordMap[word];
    if (!info) return { ok: false, error: 'word not found', wordMap };

    const now = new Date();
    info.lastSeen = nowMinute();

    if (outcome === 'mastered') {
      info.status = 'mastered';
      info.lastReviewed = now.toISOString();
      wordMap[word] = info;
      await chrome.storage.local.set({ words: wordMap });
      return { ok: true, wordMap, nextDueText: '已掌握' };
    }

    info.status = 'learning';
    ensureReviewFields(info);

    if (outcome === 'skip') {
      info.dueAt = addMinutes(now, 240);
      wordMap[word] = info;
      await chrome.storage.local.set({ words: wordMap });
      return { ok: true, wordMap, nextDueText: '4 小时后' };
    }

    info.reviewCount = Number(info.reviewCount || 0) + 1;
    info.lastReviewed = now.toISOString();

    let nextDueText;
    if (outcome === 'miss') {
      info.missCount = Number(info.missCount || 0) + 1;
      info.intervalDays = 0;
      info.dueAt = addMinutes(now, 10);
      nextDueText = '10 分钟后';
    } else if (outcome === 'hard') {
      info.intervalDays = 1;
      info.dueAt = addDays(now, 1);
      nextDueText = '明天';
    } else {
      info.correctCount = Number(info.correctCount || 0) + 1;
      info.intervalDays = nextGoodIntervalDays(info.correctCount);
      info.dueAt = addDays(now, info.intervalDays);
      nextDueText = `${info.intervalDays} 天后`;
    }

    wordMap[word] = info;
    await chrome.storage.local.set({ words: wordMap });
    return { ok: true, wordMap, nextDueText };
  });

  if (result.ok) {
    scheduleGistSync();
    updateBadge(result.wordMap);
  }
  return { ok: result.ok, error: result.error, nextDueText: result.nextDueText };
}

// ── 消息监听 ───────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'GET_INIT_DATA':
      getInitData().then(sendResponse);
      return true;

    case 'GET_DEFINITION':
      getDefinition(msg.word, msg.context).then(async (def) => {
        if (!def.error) {
          const saved = await saveDefinition(msg.word, def);
          if (!saved) pendingDefs.set(msg.word, def); // 单词尚未标记，先缓存
        }
        sendResponse(def);
      });
      return true;

    case 'MARK_WORD':
      markWord(msg.word, msg.status, msg.context).then(() => sendResponse({ ok: true }));
      return true;

    case 'DELETE_WORD': {
      serialWrite(async () => {
        const { words } = await chrome.storage.local.get('words');
        const wordMap = words || {};
        delete wordMap[msg.word];
        await chrome.storage.local.set({ words: wordMap });
        return wordMap;
      }).then(wordMap => {
        updateBadge(wordMap);
        scheduleGistSync();
        sendResponse({ ok: true });
      });
      return true;
    }

    case 'UPDATE_STATUS': {
      serialWrite(async () => {
        const { words } = await chrome.storage.local.get('words');
        const wordMap = words || {};
        if (wordMap[msg.word]) {
          const wasStatus = wordMap[msg.word].status;
          wordMap[msg.word].status = msg.status;
          wordMap[msg.word].lastSeen = nowMinute();
          if (msg.status === 'learning' && wasStatus !== 'learning') {
            wordMap[msg.word].dueAt = new Date().toISOString();
          }
          ensureReviewFields(wordMap[msg.word]);
        }
        await chrome.storage.local.set({ words: wordMap });
        return wordMap;
      }).then(wordMap => {
        updateBadge(wordMap);
        scheduleGistSync();
        sendResponse({ ok: true });
      });
      return true;
    }

    case 'REVIEW_WORD':
      reviewWord(msg.word, msg.outcome).then(sendResponse);
      return true;

    case 'TRANSLATE_TEXT':
      translateText(msg.text, msg.context).then(sendResponse);
      return true;

    case 'GET_STATS':
      chrome.storage.local.get('words').then(({ words }) => {
        sendResponse(statsFromWords(words));
      });
      return true;

    case 'PULL_GIST':
      // 打开 popup 时优先拉远端，避免用浏览器本地旧状态覆盖 iOS 刚写入的复习进度。
      (async () => {
        const hadPendingSync = Boolean(await chrome.alarms.get(GIST_SYNC_ALARM));
        if (hadPendingSync) {
          await chrome.alarms.clear(GIST_SYNC_ALARM);
        }

        const pullResult = await pullFromGist({ preserveLocal: true });
        if (hadPendingSync && pullResult.ok) {
          await syncToGist();
        }
        sendResponse(pullResult);
      })();
      return true;
  }
});

// 插件安装/启动时从 Gist 拉取最新词库
chrome.runtime.onStartup.addListener(pullFromGist);
chrome.runtime.onInstalled.addListener(pullFromGist);
