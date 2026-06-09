function syncStateText(state) {
  if (!state) return '';
  const at = state.at ? state.at.slice(0, 16).replace('T', ' ') : '';
  switch (state.code) {
    case 'created':   return `✓ 已自动创建新词库 Gist（${at}）`;
    case 'updated':   return `✓ 已同步（${at}）`;
    case 'pulled':    return `✓ 已从远端拉取（${at}）`;
    case 'forbidden': return `✗ GitHub Token 无效或缺少 gist 权限（${at}）`;
    case 'error':     return `✗ 同步失败：${state.error || '未知错误'}（${at}）`;
    default:          return state.ok ? `✓ 已同步（${at}）` : `✗ ${state.error || '同步失败'}（${at}）`;
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
    parts.push(`<a href="https://gist.github.com/${gistId}" target="_blank">在 GitHub 查看词库 ↗</a>`);
    parts.push(`最后同步: ${lastGistSync ? lastGistSync.slice(0, 16).replace('T', ' ') : '从未'}`);
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
  showStatus('✓ 设置已保存');
});

document.getElementById('syncBtn').addEventListener('click', async () => {
  showStatus('同步中...');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'PULL_GIST' });
    if (result?.ok) {
      const msg = result.code === 'created' ? '✓ 已自动创建词库 Gist' : '✓ 拉取成功';
      showStatus(msg);
    } else {
      showStatus(`✗ ${result?.error || '同步失败'}`, true);
    }
    load(); // 刷新 Gist ID 和同步时间
  } catch (e) {
    showStatus('✗ 拉取失败，请检查 Token 和 Gist ID', true);
  }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!confirm('确定清空本地词库？此操作不可撤销。')) return;
  await chrome.storage.local.set({ words: {} });
  chrome.action.setBadgeText({ text: '' });
  showStatus('✓ 已清空');
});

load();
