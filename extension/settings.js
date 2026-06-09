async function load() {
  const { deepseekApiKey, githubToken, gistId, lastGistSync } = await chrome.storage.local.get([
    'deepseekApiKey', 'githubToken', 'gistId', 'lastGistSync'
  ]);

  if (deepseekApiKey) document.getElementById('deepseekKey').value = deepseekApiKey;
  if (githubToken) document.getElementById('githubToken').value = githubToken;
  if (gistId) document.getElementById('gistId').value = gistId;

  const gistInfo = document.getElementById('gistInfo');
  if (gistId) {
    gistInfo.innerHTML = `
      <a href="https://gist.github.com/${gistId}" target="_blank">在 GitHub 查看词库 ↗</a>
      　最后同步: ${lastGistSync ? lastGistSync.slice(0, 16).replace('T', ' ') : '从未'}
    `;
  }
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
    await chrome.runtime.sendMessage({ type: 'PULL_GIST' });
    showStatus('✓ 拉取成功');
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
