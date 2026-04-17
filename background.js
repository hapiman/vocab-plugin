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

let gistSyncTimer = null;

function scheduleGistSync() {
  if (gistSyncTimer) clearTimeout(gistSyncTimer);
  gistSyncTimer = setTimeout(syncToGist, 5000); // 5秒防抖
}

async function syncToGist() {
  const { githubToken, gistId, words } = await chrome.storage.local.get(['githubToken', 'gistId', 'words']);
  if (!githubToken) return;

  const content = JSON.stringify(words || {}, null, 2);

  try {
    if (gistId) {
      // 更新已有 Gist
      await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: { 'vocab-learner.json': { content } }
        })
      });
    } else {
      // 创建新 Gist
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
      const data = await res.json();
      await chrome.storage.local.set({ gistId: data.id });
    }
    await chrome.storage.local.set({ lastGistSync: new Date().toISOString() });
  } catch (e) {
    console.error('Gist sync failed:', e);
  }
}

async function pullFromGist() {
  const { githubToken, gistId } = await chrome.storage.local.get(['githubToken', 'gistId']);
  if (!githubToken || !gistId) return;

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `Bearer ${githubToken}` }
    });
    const data = await res.json();
    const content = data.files?.['vocab-learner.json']?.content;
    if (content) {
      const words = JSON.parse(content);
      await chrome.storage.local.set({ words });
    }
  } catch (e) {
    console.error('Gist pull failed:', e);
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
      map[word].status = status;
      map[word].lastSeen = nowMinute();
    }

    if (context && map[word].contexts.length < 5) {
      const exists = map[word].contexts.some(c => c.sentence === context.sentence);
      if (!exists) map[word].contexts.push(context);
    }

    await chrome.storage.local.set({ words: map });
    return map;
  });

  scheduleGistSync();
  const learningCount = Object.values(wordMap).filter(w => w.status === 'learning').length;
  chrome.action.setBadgeText({ text: learningCount > 0 ? String(learningCount) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
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
        const learningCount = Object.values(wordMap).filter(w => w.status === 'learning').length;
        chrome.action.setBadgeText({ text: learningCount > 0 ? String(learningCount) : '' });
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
          wordMap[msg.word].status = msg.status;
          wordMap[msg.word].lastSeen = nowMinute();
        }
        await chrome.storage.local.set({ words: wordMap });
        return wordMap;
      }).then(wordMap => {
        const learningCount = Object.values(wordMap).filter(w => w.status === 'learning').length;
        chrome.action.setBadgeText({ text: learningCount > 0 ? String(learningCount) : '' });
        scheduleGistSync();
        sendResponse({ ok: true });
      });
      return true;
    }

    case 'TRANSLATE_TEXT':
      translateText(msg.text, msg.context).then(sendResponse);
      return true;

    case 'GET_STATS':
      chrome.storage.local.get('words').then(({ words }) => {
        const map = words || {};
        const learning = Object.values(map).filter(w => w.status === 'learning').length;
        const mastered = Object.values(map).filter(w => w.status === 'mastered').length;
        sendResponse({ learning, mastered, total: learning + mastered });
      });
      return true;

    case 'PULL_GIST':
      // 先把本地未推送的变更 flush 到 Gist，再 pull，避免覆盖本地最新状态
      (async () => {
        if (gistSyncTimer) {
          clearTimeout(gistSyncTimer);
          gistSyncTimer = null;
          await syncToGist();
        }
        await pullFromGist();
        sendResponse({ ok: true });
      })();
      return true;
  }
});

// 插件安装/启动时从 Gist 拉取最新词库
chrome.runtime.onStartup.addListener(pullFromGist);
chrome.runtime.onInstalled.addListener(pullFromGist);
