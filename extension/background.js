// Background Service Worker
// Handles DeepSeek API calls, storage management, and Gist sync

// ── Serialized write queue: prevent concurrent read-modify-write operations from overwriting each other ─────────────────────────

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

// ── Gist sync ──────────────────────────────────────────────────────────────

const GIST_SYNC_ALARM = 'gist-sync';

// Debounce by 5 seconds using chrome.alarms, which survive MV3 service worker termination.
// This prevents sync from being missed when the worker is terminated after saving a word and setTimeout is lost.
function scheduleGistSync() {
  // Creating an alarm with the same name replaces the previous one, providing built-in debouncing.
  chrome.alarms.create(GIST_SYNC_ALARM, { when: Date.now() + 5000 });
}


chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === GIST_SYNC_ALARM) syncToGist();
});

// Store the most recent sync result for display in settings and the popup.
async function recordSyncState(state) {
  await chrome.storage.local.set({
    lastSyncState: { ...state, at: new Date().toISOString() }
  });
}

// Create a new secret Gist on GitHub and store its gistId.
async function createGist(githubToken, content) {
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Vocab Learner - Personal Vocabulary',
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
      // Update existing Gist
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
        // Remote Gist deleted or inaccessible: clear the invalid ID and fall back to creation.
        await chrome.storage.local.remove('gistId');
        await createGist(githubToken, content);
        created = true;
      } else if (res.status === 401 || res.status === 403) {
        // Invalid token or missing gist permission: recreation would also fail, so report the error.
        const err = new Error(`GitHub API ${res.status}`);
        err.status = res.status;
        throw err;
      } else if (!res.ok) {
        const err = new Error(`GitHub API ${res.status}`);
        err.status = res.status;
        throw err;
      }
    } else {
      // No local gistId: create a new Gist
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
      ? 'Invalid GitHub token or missing gist permission'
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

    // The remote may contain recent iOS review fields; only supplement definitions and examples added by the browser.
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
    return { ok: false, code: 'no-token', error: 'Enter your GitHub token in Settings first.', stats: statsFromWords(localWords) };
  }

  // No local gistId (new account) or remote 404 (deleted): create a new Gist automatically.
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
          return { ok: false, code: 'no-file', error: 'Gist does not contain vocab-learner.json', stats: statsFromWords(localWords) };
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

    // Reaching this point means a new Gist must be created.
    const newId = await createGist(githubToken, JSON.stringify(localWords || {}, null, 2));
    const lastGistSync = new Date().toISOString();
    await chrome.storage.local.set({ lastGistSync });
    await recordSyncState({ ok: true, created: true, code: 'created', lastGistSync });
    return { ok: true, created: true, code: 'created', gistId: newId, stats: statsFromWords(localWords), lastGistSync };
  } catch (e) {
    console.error('Gist pull failed:', e);
    const forbidden = e.status === 401 || e.status === 403;
    const code = forbidden ? 'forbidden' : 'error';
    const error = forbidden ? 'Invalid GitHub token or missing gist permission' : e.message;
    await recordSyncState({ ok: false, code, error });
    return { ok: false, code: 'error', error: e.message, stats: statsFromWords(localWords) };
  }
}

// ── DeepSeek API ───────────────────────────────────────────────────────────

async function callDeepSeek(messages, maxTokens) {
  const { deepseekApiKey } = await chrome.storage.local.get('deepseekApiKey');
  if (!deepseekApiKey) {
    return { error: 'Enter your DeepSeek API key in Settings first.' };
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
        // deepseek-chat was retired on 2026-07-24; use a v4 model.
        model: 'deepseek-v4-flash',
        // Dictionary and translation tasks do not require reasoning; disable thinking to reduce latency and cost (enabled by default in v4).
        thinking: { type: 'disabled' },
        max_tokens: maxTokens,
        messages,
      })
    });
  } catch (e) {
    console.error('[VocabLearner] fetch failed:', e);
    return { error: `Network request failed: ${e.message}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[VocabLearner] API error:', res.status, body);
    if (res.status === 401) return { error: 'Invalid API key. Re-enter it in Settings.' };
    if (res.status === 429) return { error: 'Too many requests. Try again later.' };
    return { error: `API returned error ${res.status}` };
  }

  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '' };
}

async function getDefinition(word, context) {
  const { deepseekApiKey } = await chrome.storage.local.get('deepseekApiKey');
  if (!deepseekApiKey) {
    return { error: 'Enter your DeepSeek API key in Settings first.' };
  }

  const contextLine = context
    ? `The word appears in this sentence:\n"${context}"\nProvide the most appropriate definition for this context.\n`
    : '';

  const result = await callDeepSeek([{
    role: 'user',
    content: `You are an English dictionary assistant. ${contextLine}Return only JSON for the word "${word}" in the following format:
{"phonetic":"/phonetic transcription/","definition":"Part of speech and Chinese definition appropriate to the context","example":"Quote or adapt the example sentence above"}`
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

// ── Translation ───────────────────────────────────────────────────────────────────

async function translateText(text, context) {
  const { deepseekApiKey } = await chrome.storage.local.get('deepseekApiKey');
  if (!deepseekApiKey) return { error: 'Enter your DeepSeek API key first.' };

  const contextLine = context ? `Reference context (for understanding only; do not translate):\n"${context}"\n\n` : '';
  const isLong = text.split(/\s+/).length >= 5;

  const prompt = isLong
    ? `${contextLine}Translate the following English text into Chinese using these guidelines:
1. Use natural, fluent Chinese phrasing rather than literal word-for-word translation.
2. Keep proper nouns, product names, and brand names in the original English.
3. Prefer established industry translations for technical terms.
4. Return only JSON, without Markdown code fences:
{"translation":"Translation","phrases":[{"en":"Noteworthy phrase or term taken directly from the source sentence","zh":"Brief Chinese explanation"}]}
Include only 3-5 key phrases or terms that help explain the sentence; do not translate every word.

Source text: "${text}"`
    : `${contextLine}Translate the following English text into natural, fluent Chinese. Output only the translation without explanation:\n"${text}"`;

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

// ── Storage operations ───────────────────────────────────────────────────────────────

// Temporary definition cache: GET_DEFINITION may return before MARK_WORD saves the word to storage.
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
      return { ok: true, wordMap, nextDueText: 'Mastered' };
    }

    info.status = 'learning';
    ensureReviewFields(info);

    if (outcome === 'skip') {
      info.dueAt = addMinutes(now, 240);
      wordMap[word] = info;
      await chrome.storage.local.set({ words: wordMap });
      return { ok: true, wordMap, nextDueText: 'in 4 hours' };
    }

    info.reviewCount = Number(info.reviewCount || 0) + 1;
    info.lastReviewed = now.toISOString();

    let nextDueText;
    if (outcome === 'miss') {
      info.missCount = Number(info.missCount || 0) + 1;
      info.intervalDays = 0;
      info.dueAt = addMinutes(now, 10);
      nextDueText = 'in 10 minutes';
    } else if (outcome === 'hard') {
      info.intervalDays = 1;
      info.dueAt = addDays(now, 1);
      nextDueText = 'Tomorrow';
    } else {
      info.correctCount = Number(info.correctCount || 0) + 1;
      info.intervalDays = nextGoodIntervalDays(info.correctCount);
      info.dueAt = addDays(now, info.intervalDays);
      nextDueText = `in ${info.intervalDays} ${info.intervalDays === 1 ? 'day' : 'days'}`;
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

// ── Message listener ───────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'GET_INIT_DATA':
      getInitData().then(sendResponse);
      return true;

    case 'GET_DEFINITION':
      getDefinition(msg.word, msg.context).then(async (def) => {
        if (!def.error) {
          const saved = await saveDefinition(msg.word, def);
          if (!saved) pendingDefs.set(msg.word, def); // Word not marked yet; cache it first
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
      // Pull remote data when opening the popup to avoid overwriting recent iOS review progress with stale browser state.
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

// Pull the latest vocabulary from Gist on extension installation or startup.
chrome.runtime.onStartup.addListener(pullFromGist);
chrome.runtime.onInstalled.addListener(pullFromGist);
