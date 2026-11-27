let wordMap = {};
let queue = [];
let sessionTotal = 0;
let doneCount = 0;
let rememberedCount = 0;
let mode = 'card';
let toastText = '';
let queuePage = 1;
let queueSearch = '';
let selectedWord = '';
let currentSourceUrl = '';

const QUEUE_PAGE_SIZE = 8;

const el = id => document.getElementById(id);

function parseDue(value) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function isDue(info) {
  return parseDue(info.dueAt) <= Date.now();
}

function hostFromContexts(info) {
  const url = latestUrl(info);
  if (!url) return 'Local Vocabulary';
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 36);
  }
}

function latestUrl(info) {
  const contexts = info.contexts || [];
  const latest = contexts[contexts.length - 1];
  return latest?.url || '';
}

function latestSentence(info) {
  const contexts = info.contexts || [];
  const latest = contexts[contexts.length - 1];
  return latest?.sentence || '';
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatDueTag(info) {
  if (!info.dueAt) return 'Due';
  const due = parseDue(info.dueAt);
  const diffMs = due - Date.now();
  if (diffMs <= 0) return 'Due';
  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) return `in ${diffMinutes} min`;
  const diffHours = Math.ceil(diffMinutes / 60);
  if (diffHours < 24) return `in ${diffHours} hr`;
  const diffDays = Math.ceil(diffHours / 24);
  return `in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
}

function formatReviewLevel(info) {
  const count = Number(info.reviewCount || 0);
  return count > 0 ? `Review ${count}` : 'Not Reviewed';
}

function formatDateMinute(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

function buildQueue() {
  queue = Object.entries(wordMap)
    .filter(([, info]) => info.status === 'learning')
    .sort((a, b) => {
      const aDue = isDue(a[1]) ? 0 : 1;
      const bDue = isDue(b[1]) ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      return parseDue(a[1].dueAt) - parseDue(b[1].dueAt);
    })
    .map(([word, info]) => ({ word, info }));
}

function dueQueueCount() {
  return queue.filter(item => isDue(item.info)).length;
}

function getVisibleQueue() {
  const query = queueSearch.trim().toLowerCase();
  if (!query) return queue;
  return queue.filter(({ word, info }) => {
    const haystack = [
      word,
      info.definition || '',
      hostFromContexts(info),
      latestSentence(info)
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

function currentItem() {
  const visible = getVisibleQueue();
  if (visible.length === 0) {
    selectedWord = '';
    return null;
  }

  const selected = visible.find(item => item.word === selectedWord);
  if (selected) return selected;

  selectedWord = visible[0].word;
  return visible[0];
}

function summarizeSchedule() {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const tomorrowStart = new Date(todayEnd.getTime() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const learning = Object.values(wordMap).filter(info => info.status === 'learning');
  const dueBy = end => learning.filter(info => parseDue(info.dueAt) <= end.getTime()).length;
  const tomorrow = learning.filter(info => {
    const due = parseDue(info.dueAt);
    return due >= tomorrowStart.getTime() && due <= tomorrowEnd.getTime();
  }).length;

  el('planToday').textContent = dueBy(todayEnd);
  el('planTomorrow').textContent = tomorrow;
  el('planWeek').textContent = dueBy(weekEnd);
  el('planStable').textContent = Object.values(wordMap).filter(info => info.status === 'mastered').length;
}

async function loadData(resetProgress = false) {
  const result = await chrome.storage.local.get('words');
  wordMap = result.words || {};
  buildQueue();
  if (resetProgress) {
    doneCount = 0;
    rememberedCount = 0;
    selectedWord = '';
    sessionTotal = dueQueueCount();
  } else {
    sessionTotal = Math.max(sessionTotal, doneCount + dueQueueCount());
  }
  render();
}

function setReviewVisible(visible) {
  ['wordText', 'phoneticText', 'dueTag', 'levelTag', 'sourceTag', 'promptText', 'contextText'].forEach(id => {
    el(id).style.display = visible ? '' : 'none';
  });
  el('answerBlock').classList.remove('visible');
  el('showBtn').style.display = visible ? '' : 'none';
  el('ratingActions').classList.remove('visible');
  el('skipBtn').disabled = !visible;
  el('masterBtn').disabled = !visible;
  el('emptyState').classList.toggle('visible', !visible);
}

function render() {
  summarizeSchedule();
  renderMetrics();
  const current = currentItem();
  renderQueue();
  el('toast').textContent = toastText;

  if (!current) {
    renderEmptyState();
    setReviewVisible(false);
    return;
  }

  setReviewVisible(true);
  const { word, info } = current;
  const sentence = latestSentence(info);
  currentSourceUrl = latestUrl(info);
  el('wordText').textContent = word;
  el('phoneticText').textContent = info.phonetic || '';
  el('dueTag').textContent = formatDueTag(info);
  el('levelTag').textContent = formatReviewLevel(info);
  el('sourceTag').textContent = hostFromContexts(info);
  el('sourceTag').disabled = !currentSourceUrl;
  el('sourceTag').title = currentSourceUrl ? 'Open source page' : 'No source page saved';
  el('promptText').textContent = mode === 'card'
    ? 'Recall the meaning of this word before revealing the answer.'
    : 'Recall the missing word from the example sentence before revealing the answer.';
  el('contextText').textContent = formatPromptSentence(word, sentence);
  el('definitionText').textContent = info.definition || 'No definition yet. Recall it from context, then look it up again on the web page.';
  el('exampleZh').textContent = '';
  el('exampleZh').style.display = 'none';
  renderNotes(info);
}

function formatPromptSentence(word, sentence) {
  if (!sentence) return 'No example sentence saved.';
  if (mode === 'card') return sentence;
  const re = new RegExp(escapeRegExp(word), 'ig');
  return sentence.replace(re, '____');
}

function renderNotes(info) {
  const contexts = (info.contexts || []).slice(-3).reverse();
  const meta = [
    ['Added', formatDateMinute(info.firstSeen) || 'Unknown'],
    ['Last Seen', formatDateMinute(info.lastSeen) || 'Unknown']
  ];
  const contextRows = contexts.map(context => ['Example Sentence', context.sentence || '']);
  const rows = [...contextRows, ...meta].filter(([, value]) => value);
  el('notesList').innerHTML = rows.map(([label, value]) => (
    `<div class="note-item"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`
  )).join('');
}

function renderMetrics() {
  const dueCount = dueQueueCount();
  const total = Math.max(sessionTotal, doneCount + dueCount);
  el('dueCount').textContent = dueCount;
  el('doneCount').textContent = doneCount;
  el('accuracy').textContent = doneCount === 0 ? '-' : `${Math.round((rememberedCount / doneCount) * 100)}%`;
  el('progressText').textContent = dueCount
    ? `${Math.min(doneCount + 1, total)} / ${total} words`
    : doneCount > 0
      ? `Completed ${doneCount} words`
      : queue.length > 0
        ? 'No Words Due'
        : 'No Words to Review';
  el('progressBar').style.width = total > 0 ? `${Math.min((doneCount / total) * 100, 100)}%` : '0%';
  el('nextDueText').textContent = dueCount
    ? 'The next review will be scheduled after your answer.'
    : queue.length > 0
      ? 'Choose a word on the right to review early.'
      : 'Return to your vocabulary to add more words.';
}

function renderEmptyState() {
  if (queue.length === 0) {
    el('emptyTitle').textContent = 'No Words to Learn';
    el('emptyMessage').textContent = 'Words saved from web pages enter the review queue automatically.';
    return;
  }

  el('emptyTitle').textContent = 'No Matching Words';
  el('emptyMessage').textContent = 'Adjust or clear the search on the right to choose words to review.';
}

function renderQueue() {
  if (queue.length === 0) {
    queuePage = 1;
    el('queueList').innerHTML = '<div class="queue-item"><span class="queue-word">No Words to Learn</span><span class="queue-time">Done</span></div>';
    renderQueuePagination(1);
    return;
  }

  const visible = getVisibleQueue();
  if (visible.length === 0) {
    queuePage = 1;
    el('queueList').innerHTML = '<div class="queue-item"><span class="queue-word">No Matching Words</span><span class="queue-time">Search</span></div>';
    renderQueuePagination(1);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(visible.length / QUEUE_PAGE_SIZE));
  if (queuePage > totalPages) queuePage = totalPages;
  if (queuePage < 1) queuePage = 1;

  const start = (queuePage - 1) * QUEUE_PAGE_SIZE;
  const pageItems = visible.slice(start, start + QUEUE_PAGE_SIZE);

  el('queueList').innerHTML = pageItems.map((item, index) => {
    const active = item.word === selectedWord;
    return (
    `<button class="queue-item ${active ? 'active' : ''}" type="button" data-word="${escapeHtml(item.word)}">
      <span class="queue-word">${escapeHtml(item.word)}</span>
      <span class="queue-time">${active ? 'Current' : formatDueTag(item.info)}</span>
    </button>`
    );
  }).join('');
  renderQueuePagination(totalPages);
}

function renderQueuePagination(totalPages) {
  el('queuePageInfo').textContent = `Page ${queuePage} / ${totalPages}`;
  el('queuePrev').disabled = queuePage <= 1;
  el('queueNext').disabled = queuePage >= totalPages;
}

function showAnswer() {
  el('answerBlock').classList.add('visible');
  el('showBtn').style.display = 'none';
  el('ratingActions').classList.add('visible');
}

async function complete(outcome) {
  const current = currentItem();
  if (!current) return;

  setBusy(true);
  const result = await chrome.runtime.sendMessage({
    type: 'REVIEW_WORD',
    word: current.word,
    outcome
  });
  setBusy(false);

  if (!result?.ok) {
    toastText = `Save failed: ${result?.error || 'Unknown error'}`;
    render();
    return;
  }

  doneCount += 1;
  if (outcome === 'good' || outcome === 'mastered') rememberedCount += 1;
  toastText = outcome === 'mastered'
    ? `${current.word} marked as mastered`
    : `${current.word}: next review ${result.nextDueText}`;
  queuePage = 1;
  selectedWord = '';
  await loadData(false);
}

function setBusy(isBusy) {
  ['showBtn', 'skipBtn', 'masterBtn'].forEach(id => {
    el(id).disabled = isBusy;
  });
  el('ratingActions').querySelectorAll('button').forEach(button => {
    button.disabled = isBusy;
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

el('showBtn').addEventListener('click', showAnswer);
el('skipBtn').addEventListener('click', () => complete('skip'));
el('masterBtn').addEventListener('click', () => complete('mastered'));
el('sourceTag').addEventListener('click', () => {
  if (!currentSourceUrl) return;
  chrome.tabs.create({ url: currentSourceUrl });
});
el('queueSearch').addEventListener('input', event => {
  queueSearch = event.target.value;
  queuePage = 1;
  selectedWord = '';
  render();
});
el('queueList').addEventListener('click', event => {
  const button = event.target.closest('[data-word]');
  if (!button) return;
  selectedWord = button.dataset.word;
  render();
});
el('queuePrev').addEventListener('click', () => {
  if (queuePage <= 1) return;
  queuePage -= 1;
  renderQueue();
});
el('queueNext').addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(queue.length / QUEUE_PAGE_SIZE));
  if (queuePage >= totalPages) return;
  queuePage += 1;
  renderQueue();
});
el('modeSwitch').addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  mode = button.dataset.mode;
  el('modeSwitch').querySelectorAll('button').forEach(item => {
    item.classList.toggle('active', item === button);
  });
  render();
});
el('ratingActions').addEventListener('click', event => {
  const button = event.target.closest('[data-score]');
  if (!button) return;
  complete(button.dataset.score);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.words) loadData(false);
});

loadData(true);
