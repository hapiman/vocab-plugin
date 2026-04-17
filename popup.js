async function init() {
  // 加载统计
  const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
  document.getElementById('learningCount').textContent = stats.learning;
  document.getElementById('masteredCount').textContent = stats.mastered;

  // 加载启用状态
  const { enabled = true } = await chrome.storage.local.get('enabled');
  document.getElementById('enableToggle').checked = enabled;
}

document.getElementById('enableToggle').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ enabled: e.target.checked });
  // 通知当前标签页刷新
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.reload(tab.id);
  }
});

document.getElementById('vocabBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('vocabulary.html') });
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

init();
