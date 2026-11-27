async function init() {
  await loadStats();

  // Pull the Gist when opening the popup to sync iOS review progress back to the browser.
  setSyncStatus('Syncing Gist...');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'PULL_GIST' });
    if (result?.stats) renderStats(result.stats);
    if (result?.ok) {
      const prefix = result.code === 'created' ? 'Vocabulary created ' : 'Synced ';
      setSyncStatus(`${prefix}${formatTime(result.lastGistSync)}`);
    } else {
      setSyncStatus(`Sync failed: ${result?.error || 'Unknown error'}`, true);
    }
  } catch (e) {
    console.warn('[VocabLearner] popup gist refresh failed:', e);
    setSyncStatus(`Sync failed: ${e.message || 'Unknown error'}`, true);
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
