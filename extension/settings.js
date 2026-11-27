function syncStateText(state) {
  if (!state) return '';
  const at = state.at ? state.at.slice(0, 16).replace('T', ' ') : '';
  switch (state.code) {
    case 'created':   return `✓ Vocabulary Gist created automatically (${at})`;
    case 'updated':   return `✓ Synced (${at})`;
    case 'pulled':    return `✓ Pulled from remote (${at})`;
    case 'forbidden': return `✗ Invalid GitHub token or missing gist permission (${at})`;
    case 'error':     return `✗ Sync failed: ${state.error || 'Unknown error'} (${at})`;
    default:          return state.ok ? `✓ Synced (${at})` : `✗ ${state.error || 'Sync failed'} (${at})`;
  }
}

async function load() {
  const { deepseekApiKey, githubToken, gistId, lastGistSync, lastSyncState } = await chrome.storage.local.get([
    'deepseekApiKey', 'githubToken', 'gistId', 'lastGistSync', 'lastSyncState'
  ]);

  if (deepseekApiKey) document.getElementById('deepseekKey').value = deepseekApiKey;
  if (githubToken) document.getElementById('githubToken').value = githubToken;
  if (gistId) document.getElementById('gistId').value = gistId;

  const gistInfo = document.getElementById('gistInfo');
  const parts = [];
  if (gistId) {
    parts.push(`<a href="https://gist.github.com/${gistId}" target="_blank">View vocabulary on GitHub ↗</a>`);
    parts.push(`Last synced: ${lastGistSync ? lastGistSync.slice(0, 16).replace('T', ' ') : 'Never'}`);
  }
  const stateText = syncStateText(lastSyncState);
  if (stateText) {
    const color = lastSyncState.ok ? '#a6e3a1' : '#f38ba8';
    parts.push(`<span style="color:${color}">${stateText}</span>`);
  }
  gistInfo.innerHTML = parts.join('　');
}

function showStatus(msg, isError = false) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = `status ${isError ? 'error' : 'success'}`;
  el.style.display = 'inline-block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const deepseekApiKey = document.getElementById('deepseekKey').value.trim();
  const githubToken = document.getElementById('githubToken').value.trim();
  const gistId = document.getElementById('gistId').value.trim();

  await chrome.storage.local.set({ deepseekApiKey, githubToken, gistId });
  showStatus('✓ Settings saved');
});

document.getElementById('syncBtn').addEventListener('click', async () => {
  showStatus('Syncing...');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'PULL_GIST' });
    if (result?.ok) {
      const msg = result.code === 'created' ? '✓ Vocabulary Gist created automatically' : '✓ Pull successful';
      showStatus(msg);
    } else {
      showStatus(`✗ ${result?.error || 'Sync failed'}`, true);
    }
    load(); // Refresh Gist ID and sync timestamp
  } catch (e) {
    showStatus('✗ Pull failed. Check your token and Gist ID.', true);
  }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!confirm('Clear local vocabulary? This cannot be undone.')) return;
  await chrome.storage.local.set({ words: {} });
  chrome.action.setBadgeText({ text: '' });
  showStatus('✓ Cleared');
});

load();
