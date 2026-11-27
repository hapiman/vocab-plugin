let allWords = {};
let currentFilter = 'all'; // all | learning | mastered
let searchQuery = '';
let currentPage = 1;
const PAGE_SIZE = 20;

async function load() {
  const { words } = await chrome.storage.local.get('words');
  allWords = words || {};
  render();
  renderStats();
}

function render() {
  const list = document.getElementById('wordList');

  let entries = Object.entries(allWords);

  // Filter by status
  if (currentFilter !== 'all') {
    entries = entries.filter(([, w]) => w.status === currentFilter);
  }

  // Search
  if (searchQuery) {
    entries = entries.filter(([word]) => word.includes(searchQuery.toLowerCase()));
  }

  // Sort by most recent update (fall back to added time)
  entries.sort((a, b) => {
    const ta = b[1].lastSeen || b[1].firstSeen || '';
    const tb = a[1].lastSeen || a[1].firstSeen || '';
    return ta.localeCompare(tb);
  });

  // Update statistics
  const allLearning = Object.values(allWords).filter(w => w.status === 'learning').length;
  document.getElementById('learningCount').textContent = allLearning;

  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  if (total === 0) {
    list.innerHTML = `
      <div class="empty">
        <h2>${searchQuery ? 'No Matching Words' : 'No Words Yet'}</h2>
        <p>${searchQuery ? 'Try a different search term.' : 'Browse English web pages and click words to save them to your vocabulary.'}</p>
      </div>
    `;
    renderPagination(0, 0);
    return;
  }

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageEntries = entries.slice(startIdx, startIdx + PAGE_SIZE);

  list.innerHTML = pageEntries.map(([word, info], idx) => `
    <div class="word-card" data-word="${word}">
      <div class="word-index">${startIdx + idx + 1}</div>
      <div class="word-main">
        <div class="word-header">
          <span class="word-text">${word}</span>
          <span class="word-phonetic">${info.phonetic || ''}</span>
          <span class="badge ${info.status}">${info.status === 'learning' ? 'Learning' : 'Mastered'}</span>
        </div>
        <div class="word-def">${info.definition || '<span style="color:#585b70">No definition yet</span>'}</div>
        <div class="word-contexts">
          ${(info.contexts || []).slice(0, 2).map(c => {
            const urlDisplay = c.url ? (() => { try { return new URL(c.url).hostname; } catch { return c.url.slice(0, 40); } })() : '';
            return `<div class="word-context">
              ${highlightWord(c.sentence.slice(0, 400), word)}
              ${urlDisplay ? `<a class="word-context-url" href="${escHtml(c.url)}" target="_blank" title="${escHtml(c.url)}">${escHtml(urlDisplay)}</a>` : ''}
            </div>`;
          }).join('')}
        </div>
        <div class="word-meta">Added: ${info.firstSeen || 'Unknown'} · Updated: ${info.lastSeen || info.firstSeen || 'Unknown'}</div>
      </div>
      <div class="word-actions">
        ${info.status === 'mastered'
          ? `<button class="action-btn learn" data-action="learning" data-word="${word}">Relearn</button>`
          : `<button class="action-btn master" data-action="mastered" data-word="${word}">Mark as Mastered</button>`
        }
        <button class="action-btn delete" data-action="delete" data-word="${word}">Delete</button>
      </div>
    </div>
  `).join('');

  // Event delegation
  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = btn.dataset.action;
      const word = btn.dataset.word;

      if (action === 'delete') {
        if (!confirm(`Delete "${word}"?`)) return;
        await chrome.runtime.sendMessage({ type: 'DELETE_WORD', word });
        await load();
      } else {
        await chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', word, status: action });
        await load();
      }
    });
  });

  renderPagination(total, totalPages);
}

function renderPagination(total, totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;
  if (total === 0 || totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <button class="page-btn" id="pagePrev" ${currentPage <= 1 ? 'disabled' : ''}>‹ Previous</button>
    <span class="page-info">Page ${currentPage} / ${totalPages} · ${total} words</span>
    <button class="page-btn" id="pageNext" ${currentPage >= totalPages ? 'disabled' : ''}>Next ›</button>
  `;
  document.getElementById('pagePrev').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; render(); window.scrollTo(0, 0); }
  });
  document.getElementById('pageNext').addEventListener('click', () => {
    if (currentPage < totalPages) { currentPage++; render(); window.scrollTo(0, 0); }
  });
}

function localDateStr(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function renderStats() {
  const chart = document.getElementById('trendChart');
  const days = 14;
  const today = new Date();
  const counts = {};

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    counts[localDateStr(d)] = 0;
  }

  Object.values(allWords).forEach(w => {
    // firstSeen uses the format "2026-04-17 10:30"; take the first 10 characters for the date.
    const date = (w.firstSeen || '').slice(0, 10);
    if (date && counts[date] !== undefined) counts[date]++;
  });

  const entries = Object.entries(counts);
  const maxVal = Math.max(...Object.values(counts), 1);

  chart.innerHTML = entries.map(([date, count]) => `
    <div class="chart-row">
      <span class="chart-label">${date.slice(5)}</span>
      <div class="chart-bar-bg">
        <div class="chart-bar" style="width: ${(count / maxVal) * 100}%"></div>
      </div>
      <span class="chart-count">${count}</span>
    </div>
  `).join('');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlightWord(sentence, word) {
  const escaped = escHtml(sentence);
  const wordEscaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${wordEscaped})`, 'gi');
  const result = escaped.replace(re, '<mark class="word-highlight">$1</mark>');
  if (result !== escaped) return result;

  // Words in multi-word phrases may be non-contiguous in the example; highlight each word.
  if (word.includes(' ') || word.includes('...') || word.includes('…')) {
    const parts = word.split(/[\s.…]+/).filter(Boolean);
    let highlighted = escaped;
    for (const part of parts) {
      const partEscaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const partRe = new RegExp(`\\b(${partEscaped})\\b`, 'gi');
      highlighted = highlighted.replace(partRe, '<mark class="word-highlight">$1</mark>');
    }
    return highlighted;
  }
  return result;
}

// ── Event bindings ───────────────────────────────────────────────────────────────

document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  currentPage = 1;
  render();
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const tabName = tab.dataset.tab;
    if (tabName === 'list') {
      document.getElementById('listView').style.display = '';
      document.getElementById('statsView').style.display = 'none';
    } else {
      document.getElementById('listView').style.display = 'none';
      document.getElementById('statsView').style.display = '';
      renderStats();
    }
  });
});


load();

// Listen for external storage changes (Gist sync, etc.)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.words) load();
});
