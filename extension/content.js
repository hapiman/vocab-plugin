(function () {
  'use strict';

  // 防止重复注入
  if (window.__vocabLearnerInit) return;
  window.__vocabLearnerInit = true;

  let wordStatus = {};
  let popupEl = null;
  let activeSpan = null;
  let currentDef = null; // 当前 popup 的释义，供保存例句用
  let learningRegexCache = null; // 已标记词/词组的合并正则缓存
  let selectionIconEl = null; // 选中文字后显示的小图标
  let pendingIconAction = null; // 点击图标时执行的回调

  // ── 初始化 ─────────────────────────────────────────────────────────────

  async function init() {
    try {
      const data = await chrome.runtime.sendMessage({ type: 'GET_INIT_DATA' });
      wordStatus = data.wordStatus || {};
    } catch (e) {
      return; // 扩展未就绪时静默退出
    }

    processNode(document.body);

    // 监听动态内容
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        // 文本内容被直接改写（React 常见）：重扫其父元素
        if (m.type === 'characterData') {
          const el = m.target.parentElement;
          if (el) processNode(el);
          continue;
        }
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processNode(node);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            // 文本节点被单独插入到已有元素里：扫描其父元素
            // （用 processNode 而非直接 replaceTextNode，以复用跳过规则）
            processNode(node.parentElement);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // 点击页面其他地方关闭弹窗
    document.addEventListener('click', onDocClick, true);
    // 选中文字后弹出查词菜单
    // 用捕获阶段监听：部分站点（如 X/Twitter）会在冒泡阶段对
    // mouseup/dblclick 调用 stopPropagation（用于区分“点击打开推文”和
    // “拖选文字”），导致挂在 document 冒泡阶段的监听器完全收不到事件。
    document.addEventListener('mouseup', onSelectionEnd, true);
    // 双击单词直接弹出释义
    document.addEventListener('dblclick', onDblClickWord, true);
  }

  // ── DOM 处理 ───────────────────────────────────────────────────────────

  const SKIP_TAGS = new Set([
    'script','style','noscript','textarea','input','select','code','pre',
    'kbd','var','samp','svg','math','button','a'
  ]);

  function processNode(root, fullRescan = false) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

    // 全量重扫时，先把已有的 vocab-word span 还原为文本节点，
    // 避免之前单独标记的词把短语拆散导致短语无法匹配
    if (fullRescan) {
      root.querySelectorAll('.vocab-word').forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
      });
      root.normalize(); // 合并相邻文本节点
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          if (el.closest('.vocab-popup')) return NodeFilter.FILTER_REJECT;
          if (el.classList.contains('vocab-word')) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(el.tagName.toLowerCase())) return NodeFilter.FILTER_REJECT;
          // 跳过真正可编辑的区域（如发推框）。用 isContentEditable 而非
          // closest('[contenteditable]')：后者会把 contenteditable="false"
          // 也算进去，而 X/Twitter 用只读的 contenteditable="false" 容器
          // 渲染推文正文，会导致正文被整体跳过、无法标记。
          if (el.isContentEditable) return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(replaceTextNode);
  }

  const WORD_RE = /\b([a-zA-Z][a-zA-Z']{2,})\b/g;

  // 根据 wordStatus 构建合并正则（多词词组排前面，保证优先匹配）
  function buildLearningRegex() {
    if (learningRegexCache) return learningRegexCache;
    const entries = Object.entries(wordStatus)
      .filter(([, v]) => v.status === 'learning')
      .map(([k]) => k)
      .sort((a, b) => b.split(' ').length - a.split(' ').length);
    if (entries.length === 0) return null;
    const pattern = entries
      .map(e => e.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'))
      .join('|');
    try {
      learningRegexCache = new RegExp(`(?<![a-zA-Z])(${pattern})(?![a-zA-Z])`, 'gi');
    } catch (e) {
      return null; // 某个词导致正则非法时，避免整体崩溃
    }
    return learningRegexCache;
  }

  function replaceTextNode(textNode) {
    const text = textNode.textContent;
    const re = buildLearningRegex();
    if (!re) return;

    re.lastIndex = 0;
    if (!re.test(text)) return;

    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let m;

    while ((m = re.exec(text)) !== null) {
      const matched = m[0];
      const key = matched.toLowerCase().replace(/\s+/g, ' ');
      const start = m.index;
      const end = start + matched.length;

      if (start > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      const span = document.createElement('span');
      span.className = 'vocab-word vocab-learning';
      span.textContent = matched;
      span.dataset.word = key;
      span.addEventListener('click', onWordClick);
      frag.appendChild(span);

      lastIndex = end;
    }

    if (lastIndex === 0) return;
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    try {
      textNode.parentNode.replaceChild(frag, textNode);
    } catch (e) {
      // DOM 结构已变化，忽略
    }
  }

  // ── 鼠标事件 ───────────────────────────────────────────────────────────

  let wordClickTimer = null;

  function onWordClick(e) {
    e.stopPropagation();
    const span = e.currentTarget;

    // 延迟执行，给 dblclick 机会取消
    if (wordClickTimer) { clearTimeout(wordClickTimer); wordClickTimer = null; }
    wordClickTimer = setTimeout(() => {
      wordClickTimer = null;
      if (activeSpan === span && popupEl) {
        removePopup();
        return;
      }
      removeSelectionIcon();
      showPopup(span);
    }, 200);
  }

  // ── 选中图标 ───────────────────────────────────────────────────────────

  function showSelectionIcon(type, rect, onClick) {
    removePopup();
    removeSelectionIcon();

    pendingIconAction = onClick;
    selectionIconEl = document.createElement('div');
    selectionIconEl.className = 'vocab-selection-icon';
    selectionIconEl.textContent = type === 'word' ? 'Aa' : '译';
    selectionIconEl.dataset.type = type;

    // 用视口坐标（position: fixed），不加 scroll 偏移。
    // 某些 SPA（如 X/Twitter）用内部容器滚动，window.scrollY 恒为 0，
    // 若按文档坐标定位会把图标放到页面顶端视口外，导致「元素存在却看不见」。
    const top = rect.top - 36;
    const left = Math.min(rect.right + 6, window.innerWidth - 48);

    selectionIconEl.style.top = `${Math.max(4, top)}px`;
    selectionIconEl.style.left = `${left}px`;

    selectionIconEl.addEventListener('click', e => {
      e.stopPropagation();
      const action = pendingIconAction;
      removeSelectionIcon();
      if (action) action();
    });

    document.body.appendChild(selectionIconEl);
  }

  function removeSelectionIcon() {
    if (selectionIconEl) {
      selectionIconEl.remove();
      selectionIconEl = null;
    }
    pendingIconAction = null;
  }

  // ── Popup ──────────────────────────────────────────────────────────────

  function showPopup(span) {
    const word = span.dataset.word;
    if (activeSpan === span && popupEl) return;

    removePopup();
    activeSpan = span;
    currentDef = null;

    popupEl = document.createElement('div');
    popupEl.className = 'vocab-popup';
    popupEl.innerHTML = `
      <div class="vocab-popup-header">
        <span class="vocab-popup-word">${word}</span>
        <span class="vocab-popup-phonetic"></span>
        <button class="vocab-btn-refresh" title="AI 重新查询">🔄</button>
      </div>
      <div class="vocab-popup-body">
        <div class="vocab-popup-loading">查询中...</div>
      </div>
      <div class="vocab-popup-actions">
        <button class="vocab-btn vocab-btn-learn" title="加入生词本，稍后复习">📌 生词本</button>
        <button class="vocab-btn vocab-btn-master" title="已掌握，不再标记">✓ 已掌握</button>
        <button class="vocab-btn vocab-btn-save-example" title="保存当前例句">💾</button>
      </div>
    `;

    document.body.appendChild(popupEl);
    positionPopup(span);

    // 点击 popup 内部不触发 onDocClick
    popupEl.addEventListener('click', e => e.stopPropagation());

    popupEl.querySelector('.vocab-btn-learn').addEventListener('click', () => {
      markWord(word, 'learning', span);
    });
    popupEl.querySelector('.vocab-btn-master').addEventListener('click', () => {
      markWord(word, 'mastered', span);
    });
    popupEl.querySelector('.vocab-btn-save-example').addEventListener('click', () => {
      saveExample(word, span);
    });

    const context = getSentenceContext(span);
    const doAiFetch = () => {
      if (!popupEl) return;
      popupEl.querySelector('.vocab-popup-body').innerHTML = '<div class="vocab-popup-loading">查询中...</div>';
      chrome.runtime.sendMessage({ type: 'GET_DEFINITION', word, context }).then(def => {
        currentDef = def;
        updatePopupBody(def);
      });
    };
    popupEl.querySelector('.vocab-btn-refresh').addEventListener('click', doAiFetch);

    // 有缓存释义则直接显示，否则自动调 AI
    const cached = wordStatus[word];
    if (cached?.definition) {
      updatePopupBody({ phonetic: cached.phonetic || '', definition: cached.definition });
    } else {
      doAiFetch();
    }
  }

  function positionPopup(anchor) {
    positionPopupByRect(anchor.getBoundingClientRect());
  }

  function positionPopupByRect(rect) {
    // 用视口坐标（position: fixed），不加 scroll 偏移，理由同 showSelectionIcon。
    popupEl.style.top = '-9999px';
    popupEl.style.left = '0px';

    requestAnimationFrame(() => {
      if (!popupEl) return;
      const popupW = popupEl.offsetWidth || 300;
      const popupH = popupEl.offsetHeight || 160;

      let left = rect.left;
      if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
      if (left < 8) left = 8;

      const top = (rect.top > popupH + 12)
        ? rect.top - popupH - 8
        : rect.bottom + 8;

      popupEl.style.left = `${left}px`;
      popupEl.style.top = `${top}px`;
    });
  }

  function updatePopupBody(def) {
    if (!popupEl) return;
    const body = popupEl.querySelector('.vocab-popup-body');
    const phonetic = popupEl.querySelector('.vocab-popup-phonetic');

    if (def.error) {
      body.innerHTML = `<div class="vocab-popup-error">${def.error}</div>`;
      return;
    }

    if (phonetic) phonetic.textContent = def.phonetic || '';

    body.innerHTML = `
      <div class="vocab-popup-definition">${def.definition || ''}</div>
      ${def.example ? `<div class="vocab-popup-example">${def.example}</div>` : ''}
    `;
  }

  function removePopup() {
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
    activeSpan = null;
    currentDef = null;
  }

  function onDocClick(e) {
    // 点选中图标由图标自己处理
    if (selectionIconEl && selectionIconEl.contains(e.target)) return;
    // 点 popup 内部不关闭
    if (popupEl && popupEl.contains(e.target)) return;
    // 点生词 span 由 onWordClick 处理
    if (e.target.classList.contains('vocab-word')) return;

    // 仍有选区说明 mouseup 刚触发了图标，click 紧随其后不应关闭图标
    if (window.getSelection()?.toString().trim()) return;

    removeSelectionIcon();
    removePopup();
  }

  // ── 标记操作 ───────────────────────────────────────────────────────────

  // 从 node 向上查找块级祖先，返回包含 word 的文本上下文
  function getBlockAncestorText(node, word) {
    if (!node) return '';
    const blockTags = new Set(['p','div','li','td','th','article','section','blockquote','dd','dt','h1','h2','h3','h4','h5','h6','pre','figcaption']);
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const wordLower = word.toLowerCase();
    // 先尝试直接父文本
    while (el && el !== document.body) {
      if (blockTags.has(el.tagName.toLowerCase())) break;
      el = el.parentElement;
    }
    if (!el || el === document.body) el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
    const text = el?.textContent || '';
    if (text.toLowerCase().indexOf(wordLower) !== -1) return text;
    // 块级元素内找不到，向上再找一层
    if (el?.parentElement && el.parentElement !== document.body) {
      const upperText = el.parentElement.textContent || '';
      if (upperText.toLowerCase().indexOf(wordLower) !== -1) return upperText;
    }
    return text;
  }

  function extractSentenceAround(text, word) {
    const textLower = text.toLowerCase();
    const wordLower = word.toLowerCase();
    let idx = textLower.indexOf(wordLower);

    // 对多词短语，若精确匹配失败，尝试按词序逐词查找（覆盖词被其他内容隔开的情况）
    if (idx === -1 && (wordLower.includes(' ') || wordLower.includes('...') || wordLower.includes('…'))) {
      const parts = wordLower.split(/[\s.…]+/).filter(Boolean);
      let searchFrom = 0;
      let firstIdx = -1;
      let lastEnd = -1;
      let allFound = true;
      for (const part of parts) {
        const partIdx = textLower.indexOf(part, searchFrom);
        if (partIdx === -1) { allFound = false; break; }
        if (firstIdx === -1) firstIdx = partIdx;
        lastEnd = partIdx + part.length;
        searchFrom = lastEnd;
      }
      if (allFound && firstIdx !== -1) {
        // 用第一个词的位置作为锚点，截取到最后一个词结束
        idx = firstIdx;
        const before = text.slice(0, idx);
        const sentenceStartMatch = before.search(/[.!?。！？\n][^.!?。！？\n]*$/);
        const sentenceStart = sentenceStartMatch === -1 ? 0 : sentenceStartMatch + 1;
        const after = text.slice(lastEnd);
        const sentenceEndMatch = after.search(/[.!?。！？\n]/);
        const sentenceEnd = lastEnd + (sentenceEndMatch === -1 ? after.length : sentenceEndMatch + 1);
        return text.slice(Math.max(0, sentenceStart), sentenceEnd).trim().slice(0, 600);
      }
    }

    if (idx === -1) return text.trim().slice(0, 200);
    const before = text.slice(0, idx);
    const sentenceStartMatch = before.search(/[.!?。！？\n][^.!?。！？\n]*$/);
    const sentenceStart = sentenceStartMatch === -1 ? 0 : sentenceStartMatch + 1;
    const after = text.slice(idx + word.length);
    const sentenceEndMatch = after.search(/[.!?。！？\n]/);
    const sentenceEnd = idx + word.length + (sentenceEndMatch === -1 ? after.length : sentenceEndMatch + 1);
    return text.slice(Math.max(0, sentenceStart), sentenceEnd).trim().slice(0, 600);
  }

  function getSentenceContext(span) {
    const word = span.textContent;
    // 向上查找包含完整句子的块级祖先，避免直接父元素太窄导致取不到上下文
    const blockTags = new Set(['p','div','li','td','th','article','section','blockquote','dd','dt','h1','h2','h3','h4','h5','h6','pre','figcaption']);
    let el = span.parentElement;
    while (el && el !== document.body) {
      if (blockTags.has(el.tagName.toLowerCase())) break;
      el = el.parentElement;
    }
    if (!el || el === document.body) el = span.parentElement;
    const parentText = el?.textContent || '';
    // 如果在当前块级元素中找不到单词，再尝试向上一层
    if (parentText.toLowerCase().indexOf(word.toLowerCase()) === -1 && el?.parentElement) {
      const upperText = el.parentElement.textContent || '';
      if (upperText.toLowerCase().indexOf(word.toLowerCase()) !== -1) {
        return extractSentenceAround(upperText, word);
      }
    }
    return extractSentenceAround(parentText, word);
  }

  function getContext(span) {
    // 提取所在句子作为上下文
    const sentence = getSentenceContext(span);
    return {
      sentence,
      url: location.href,
      date: new Date().toISOString().slice(0, 10)
    };
  }

  async function markWord(word, status, span, contextOverride) {
    const context = contextOverride ?? getContext(span);
    await chrome.runtime.sendMessage({ type: 'MARK_WORD', word, status, context });

    wordStatus[word] = { status };
    learningRegexCache = null; // 词库变了，重建正则

    if (status === 'mastered') {
      // 移除所有该词的下划线
      document.querySelectorAll(`.vocab-word[data-word="${word}"]`).forEach(el => {
        const text = document.createTextNode(el.textContent);
        el.parentNode.replaceChild(text, el);
      });
    } else if (status === 'learning') {
      // 全量重扫：先还原已有 span 再重建，避免短语被单词 span 拆散
      processNode(document.body, true);
    }

    removePopup();
  }

  async function saveExample(word, span) {
    const context = getContext(span);
    await chrome.runtime.sendMessage({ type: 'MARK_WORD', word, status: wordStatus[word]?.status || 'learning', context });

    // 显示保存成功提示
    const actions = popupEl?.querySelector('.vocab-popup-actions');
    if (actions) {
      const tip = document.createElement('div');
      tip.className = 'vocab-popup-saved-tip';
      tip.textContent = '例句已保存 ✓';
      popupEl.insertBefore(tip, actions);
      setTimeout(() => tip.remove(), 1500);
    }
  }

  // ── 选中查词 ───────────────────────────────────────────────────────────

  function isEnglishPage() {
    const lang = (document.documentElement.lang || '').toLowerCase();
    if (lang) return lang.startsWith('en');
    // 无 lang 属性时，采样页面文本判断
    const sample = (document.body?.innerText || '').replace(/\s+/g, '').slice(0, 400);
    if (!sample) return false;
    const nonAscii = (sample.match(/[^\x00-\x7F]/g) || []).length;
    return nonAscii / sample.length < 0.1;
  }

  function onDblClickWord(e) {
    // 取消单击延迟，防止闪烁
    if (wordClickTimer) { clearTimeout(wordClickTimer); wordClickTimer = null; }

    // 不干扰弹窗内部交互
    if (popupEl && popupEl.contains(e.target)) return;
    if (selectionIconEl && selectionIconEl.contains(e.target)) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText) return;

    // 只处理单个英文单词
    if (!/^[a-zA-Z][a-zA-Z'-]{1,29}$/.test(selectedText)) return;

    const normalizedWord = selectedText.toLowerCase();

    let rect;
    try {
      rect = selection.getRangeAt(0).getBoundingClientRect();
    } catch { return; }
    if (!rect || rect.width === 0) return;

    // 提取所在句子作为上下文：优先从块级祖先获取，确保包含目标词
    const contextText = getBlockAncestorText(selection?.anchorNode, normalizedWord);
    const context = {
      sentence: extractSentenceAround(contextText, normalizedWord),
      url: location.href,
      date: new Date().toISOString().slice(0, 10),
    };

    removeSelectionIcon();
    removePopup();
    showSelectionPopup(normalizedWord, rect, context);
  }

  function onSelectionEnd(e) {
    if (selectionIconEl && selectionIconEl.contains(e.target)) return;
    if (popupEl && popupEl.contains(e.target)) return;
    if (e.target && e.target.classList && e.target.classList.contains('vocab-word')) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText || selectedText.length < 2) return;

    let rect;
    try {
      const range = selection.getRangeAt(0);
      rect = range.getBoundingClientRect();
      // 多行选区 getBoundingClientRect 有时返回 width=0，改用最后一个 clientRect
      if (!rect || rect.width === 0) {
        const rects = range.getClientRects();
        if (rects.length > 0) rect = rects[rects.length - 1];
      }
    } catch (e) { return; }
    if (!rect || rect.width === 0) return;

    // 纯英文单词（含连字符）→ 查词；纯英文短语（≤6词）→ 查词
    const isWord = /^[a-zA-Z][a-zA-Z'-]{1,29}$/.test(selectedText);
    const isEnPhrase = !isWord && /^[a-zA-Z][a-zA-Z' -]*[a-zA-Z]$/.test(selectedText) && selectedText.split(/\s+/).length <= 6;
    if (isWord || isEnPhrase) {
      const normalizedWord = selectedText.toLowerCase().replace(/\s+/g, ' ');
      if (wordStatus[normalizedWord]?.status === 'learning') return;
      // 从块级祖先获取上下文，确保包含目标词
      const contextText = getBlockAncestorText(selection?.anchorNode, normalizedWord);
      const capturedContext = {
        sentence: extractSentenceAround(contextText, normalizedWord),
        url: location.href,
        date: new Date().toISOString().slice(0, 10),
      };
      showSelectionIcon('word', rect, () => showSelectionPopup(normalizedWord, rect, capturedContext));
    } else if (selectedText.length >= 4) {
      // 检查选中文本本身是否为英文（而非页面语言），避免中文页面误触发
      const nonAscii = (selectedText.match(/[^\x00-\x7F]/g) || []).length;
      const isEnglishContent = nonAscii / selectedText.replace(/\s/g, '').length < 0.15;
      if (isEnglishContent) {
        const contextText = getBlockAncestorText(selection?.anchorNode, selectedText);
        showSelectionIcon('translate', rect, () => showTranslationPopup(selectedText, rect, contextText.slice(0, 300)));
      }
    }
  }

  function showSelectionPopup(word, selectionRect, capturedContext) {
    removePopup();
    activeSpan = null;
    currentDef = null;

    popupEl = document.createElement('div');
    popupEl.className = 'vocab-popup';
    popupEl.innerHTML = `
      <div class="vocab-popup-header">
        <span class="vocab-popup-word">${word}</span>
        <span class="vocab-popup-phonetic"></span>
        <button class="vocab-btn-refresh" title="AI 重新查询">🔄</button>
      </div>
      <div class="vocab-popup-body">
        <div class="vocab-popup-loading">查询中...</div>
      </div>
      <div class="vocab-popup-actions">
        <button class="vocab-btn vocab-btn-learn" title="加入生词本">📌 生词本</button>
        <button class="vocab-btn vocab-btn-master" title="标记为已掌握">✓ 已掌握</button>
      </div>
    `;
    document.body.appendChild(popupEl);
    positionPopupByRect(selectionRect);

    const context = capturedContext || {
      sentence: '',
      url: location.href,
      date: new Date().toISOString().slice(0, 10),
    };

    popupEl.addEventListener('click', e => e.stopPropagation());

    popupEl.querySelector('.vocab-btn-learn').addEventListener('click', () => {
      markWord(word, 'learning', null, context);
    });
    popupEl.querySelector('.vocab-btn-master').addEventListener('click', () => {
      markWord(word, 'mastered', null, context);
    });

    const doAiFetch = () => {
      if (!popupEl) return;
      popupEl.querySelector('.vocab-popup-body').innerHTML = '<div class="vocab-popup-loading">查询中...</div>';
      chrome.runtime.sendMessage({ type: 'GET_DEFINITION', word, context: context.sentence }).then(def => {
        currentDef = def;
        updatePopupBody(def);
      });
    };
    popupEl.querySelector('.vocab-btn-refresh').addEventListener('click', doAiFetch);

    // 有缓存释义则直接显示，否则自动调 AI
    const cached = wordStatus[word];
    if (cached?.definition) {
      updatePopupBody({ phonetic: cached.phonetic || '', definition: cached.definition });
    } else {
      doAiFetch();
    }
  }

  function showTranslationPopup(text, selectionRect, surroundingText) {
    removePopup();

    const normalizedPhrase = text.toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]+$/, '').trim();

    popupEl = document.createElement('div');
    popupEl.className = 'vocab-popup vocab-popup-translate';
    popupEl.innerHTML = `
      <div class="vocab-popup-src">${escHtml(text.length > 100 ? text.slice(0, 100) + '…' : text)}</div>
      <div class="vocab-popup-body">
        <div class="vocab-popup-loading">翻译中...</div>
      </div>
      <div class="vocab-popup-actions">
        <button class="vocab-btn vocab-btn-learn">📌 生词本</button>
        <button class="vocab-btn vocab-btn-master">✓ 已掌握</button>
      </div>
    `;
    popupEl.addEventListener('click', e => e.stopPropagation());
    document.body.appendChild(popupEl);
    positionPopupByRect(selectionRect);

    const context = { sentence: extractSentenceAround(surroundingText || text, normalizedPhrase), url: location.href, date: new Date().toISOString().slice(0, 10) };
    const savePhrase = async (status) => {
      await markWord(normalizedPhrase, status, null, context);
      // 异步获取释义并存储（markWord 已完成，saveDefinition 能找到该词）
      chrome.runtime.sendMessage({ type: 'GET_DEFINITION', word: normalizedPhrase, context: context.sentence });
    };
    popupEl.querySelector('.vocab-btn-learn').addEventListener('click', () => savePhrase('learning'));
    popupEl.querySelector('.vocab-btn-master').addEventListener('click', () => savePhrase('mastered'));

    chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text, context: surroundingText })
      .then(result => {
        if (!popupEl) return;
        const body = popupEl.querySelector('.vocab-popup-body');
        if (result.error) {
          body.innerHTML = `<div class="vocab-popup-error">${result.error}</div>`;
          return;
        }
        const phrasesHtml = (result.phrases || []).map((p, i) => `
          <div class="vocab-phrase-row" data-idx="${i}">
            <span class="vocab-phrase-en">${escHtml(p.en)}</span>
            <span class="vocab-phrase-zh">${escHtml(p.zh)}</span>
            <button class="vocab-phrase-pin" data-phrase="${escHtml(p.en)}" title="加入生词本">📌</button>
          </div>
        `).join('');

        body.innerHTML = `
          <div class="vocab-popup-translation">${escHtml(result.translation)}</div>
          ${phrasesHtml ? `<div class="vocab-phrases">${phrasesHtml}</div>` : ''}
        `;

        // 绑定词组 📌 按钮
        body.querySelectorAll('.vocab-phrase-pin').forEach(btn => {
          btn.addEventListener('click', async e => {
            e.stopPropagation();
            const phrase = btn.dataset.phrase.toLowerCase().replace(/\s+/g, ' ');
            await chrome.runtime.sendMessage({
              type: 'MARK_WORD', word: phrase, status: 'learning',
              context: { sentence: extractSentenceAround(text, phrase), url: location.href, date: new Date().toISOString().slice(0, 10) },
            });
            wordStatus[phrase] = { status: 'learning' };
            learningRegexCache = null;
            processNode(document.body, true);
            btn.textContent = '✓';
            btn.disabled = true;
            btn.classList.add('vocab-phrase-pin-saved');
            // 后台异步获取释义并保存，不影响当前交互
            chrome.runtime.sendMessage({ type: 'GET_DEFINITION', word: phrase, context: extractSentenceAround(text, phrase) });
            // 不关闭弹窗，让用户继续点其他词组
          });
        });

        // 重新定位（内容变多了，高度变了）
        positionPopupByRect(selectionRect);
      });
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Storage 变化监听（Gist 同步 / 其他页面操作） ─────────────────────────

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.words) return;
    const newWords = changes.words.newValue || {};
    const oldWords = changes.words.oldValue || {};

    // 找出被删除或改为 mastered 的词 → 移除页面划线
    for (const word of Object.keys(oldWords)) {
      const wasLearning = oldWords[word]?.status === 'learning';
      const nowGone = !newWords[word] || newWords[word].status !== 'learning';
      if (wasLearning && nowGone) {
        document.querySelectorAll(`.vocab-word[data-word="${word}"]`).forEach(el => {
          el.replaceWith(document.createTextNode(el.textContent));
        });
      }
    }

    // 更新本地缓存
    wordStatus = newWords;
    learningRegexCache = null;

    // 找出新增的 learning 词 → 扫描页面添加划线
    const newlyLearning = Object.keys(newWords).filter(
      w => newWords[w]?.status === 'learning' && oldWords[w]?.status !== 'learning'
    );
    if (newlyLearning.length > 0) {
      processNode(document.body, true);
    }
  });

  // ── 启动 ───────────────────────────────────────────────────────────────

  init();
})();
