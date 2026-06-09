async function init() {
  await loadStats();

  // 打开插件弹窗时拉取一次 Gist，确保 iOS 端的复习进度同步回浏览器。
  setSyncStatus('同步 Gist 中...');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'PULL_GIST' });
    if (result?.stats) renderStats(result.stats);
    if (result?.ok) {
      const prefix = result.code === 'created' ? '已创建词库 ' : '已同步 ';
      setSyncStatus(`${prefix}${formatTime(result.lastGistSync)}`);
    } else {
      setSyncStatus(`同步失败：${result?.error || '未知错误'}`, true);
    }
  } catch (e) {
    console.warn('[VocabLearner] popup gist refresh failed:', e);
    setSyncStatus(`同步失败：${e.message || '未知错误'}`, true);
  }
}

async function loadStats() {
  const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
  renderStats(stats);
}

function renderStats(stats) {
  document.getElementById('learningCount').textContent = stats.learning;
  document.getElementById('masteredCount').textContent = stats.mastered;
  document.getElementById('reviewDueCount').textContent = stats.reviewDue ?? 0;
}

function setSyncStatus(text, isError = false) {
  const el = document.getElementById('syncStatus');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}`;
}

document.getElementById('reviewBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('review.html') });
});

document.getElementById('vocabBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('vocabulary.html') });
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

init();
