(function () {
  'use strict';

  // Prevent duplicate injection
  if (window.__vocabLearnerInit) return;
  window.__vocabLearnerInit = true;

  let wordStatus = {};
  let popupEl = null;
  let activeSpan = null;
  let currentDef = null; // Definition in the current popup, used when saving examples
  let learningRegexCache = null; // Cached combined regex for marked words and phrases
  let selectionIconEl = null; // Small icon shown after selecting text
  let pendingIconAction = null; // Callback invoked when the icon is clicked

  // ── Initialization ─────────────────────────────────────────────────────────────

  async function init() {
    try {
      const data = await chrome.runtime.sendMessage({ type: 'GET_INIT_DATA' });
      wordStatus = data.wordStatus || {};
    } catch (e) {
      return; // Exit silently if the extension is not ready
    }

    processNode(document.body);

    // Observe dynamic content
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        // Text was modified directly (common in React): rescan its parent element
        if (m.type === 'characterData') {
          const el = m.target.parentElement;
          if (el) processNode(el);
          continue;
        }
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processNode(node);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            // A text node was inserted into an existing element: scan its parent element
            // (Use processNode rather than replaceTextNode to reuse skip rules.)
            processNode(node.parentElement);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Close the popup when clicking elsewhere on the page
    document.addEventListener('click', onDocClick, true);
    // Show the lookup menu after selecting text
    // Listen during capture: some sites (such as X/Twitter) call
    // stopPropagation on mouseup/dblclick during bubbling (to distinguish opening a post from
    // selecting text), preventing document-level bubbling listeners from receiving the event.
    document.addEventListener('mouseup', onSelectionEnd, true);
    // Double-click a word to show its definition
    document.addEventListener('dblclick', onDblClickWord, true);
    window.addEventListener('resize', () => {
      if (popupEl) keepPopupInViewport(popupEl);
    });
  }

  // ── DOM processing ───────────────────────────────────────────────────────────

  const SKIP_TAGS = new Set([
    'script','style','noscript','textarea','input','select','code','pre',
    'kbd','var','samp','svg','math','button','a'
  ]);

  function processNode(root, fullRescan = false) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

    // Before a full rescan, restore existing vocab-word spans to text nodes
    // so individually marked words do not split phrases and prevent matching.
    if (fullRescan) {
      root.querySelectorAll('.vocab-word').forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
      });
      root.normalize(); // Merge adjacent text nodes
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
          // Skip genuinely editable areas (such as the post composer). Use isContentEditable rather than
          // closest('[contenteditable]'): the latter also matches contenteditable="false",
          // and X/Twitter uses read-only contenteditable="false" containers
          // for post text, which would otherwise be skipped entirely.
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

  // Build a combined regex from wordStatus, prioritizing multi-word phrases.
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
      return null; // Avoid crashing if a word produces an invalid regex
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
      // DOM structure changed; ignore
    }
  }

  // ── Mouse events ───────────────────────────────────────────────────────────

  let wordClickTimer = null;

  function onWordClick(e) {
    e.stopPropagation();
    const span = e.currentTarget;

    // Delay execution so dblclick can cancel it
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

  // ── Selection icon ───────────────────────────────────────────────────────────

  function showSelectionIcon(type, rect, onClick) {
    removePopup();
    removeSelectionIcon();

    pendingIconAction = onClick;
    selectionIconEl = document.createElement('div');
    selectionIconEl.className = 'vocab-selection-icon';
    selectionIconEl.textContent = type === 'word' ? 'Aa' : 'Tr';
    selectionIconEl.dataset.type = type;

    // Use viewport coordinates (position: fixed), without scroll offsets.
    // Some SPAs (such as X/Twitter) scroll internal containers, so window.scrollY remains 0.
    // Document coordinates could place the icon outside the viewport, making it invisible.
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
        <button class="vocab-btn-refresh" title="Look Up Again with AI">🔄</button>
      </div>
      <div class="vocab-popup-body">
        <div class="vocab-popup-loading">Looking up...</div>
      </div>
      <div class="vocab-popup-actions">
        <button class="vocab-btn vocab-btn-learn" title="Save to Vocabulary for Later Review">📌 Vocabulary</button>
        <button class="vocab-btn vocab-btn-master" title="Mastered; Stop Highlighting">✓ Mastered</button>
        <button class="vocab-btn vocab-btn-save-example" title="Save Current Example Sentence">💾</button>
      </div>
    `;

    document.body.appendChild(popupEl);
    enablePopupDrag(popupEl);
    positionPopup(span);

    // Clicks inside the popup do not trigger onDocClick
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
      popupEl.querySelector('.vocab-popup-body').innerHTML = '<div class="vocab-popup-loading">Looking up...</div>';
      chrome.runtime.sendMessage({ type: 'GET_DEFINITION', word, context }).then(def => {
        currentDef = def;
        updatePopupBody(def);
      });
    };
    popupEl.querySelector('.vocab-btn-refresh').addEventListener('click', doAiFetch);

    // Show the cached definition if present; otherwise call AI automatically
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

  function movePopupWithinViewport(popup, left, top) {
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - popup.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - popup.offsetHeight - margin);
    popup.style.left = `${Math.max(margin, Math.min(left, maxLeft))}px`;
    popup.style.top = `${Math.max(margin, Math.min(top, maxTop))}px`;
  }

  function keepPopupInViewport(popup) {
    movePopupWithinViewport(popup, parseFloat(popup.style.left), parseFloat(popup.style.top));
  }

  function enablePopupDrag(popup) {
    const handle = popup.querySelector('.vocab-popup-header, .vocab-popup-src');
    handle.title = 'Drag to move';
    let drag = null;

    handle.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0 || e.target.closest('button, a, input')) return;
      e.preventDefault();
      e.stopPropagation();
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: parseFloat(popup.style.left),
        top: parseFloat(popup.style.top),
      };
      popup.dataset.userMoved = 'true';
      popup.classList.add('vocab-popup-dragging');
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      movePopupWithinViewport(popup, drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y);
    });

    const stopDrag = e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      popup.classList.remove('vocab-popup-dragging');
    };
    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
    handle.addEventListener('lostpointercapture', stopDrag);
  }

  function positionPopupByRect(rect) {
    const popup = popupEl;
    if (!popup) return;
    if (popup.dataset.userMoved) {
      keepPopupInViewport(popup);
      return;
    }

    // Use viewport coordinates (position: fixed), without scroll offsets, for the same reason as showSelectionIcon.
    const popupH = popup.offsetHeight;
    const top = (rect.top > popupH + 12)
      ? rect.top - popupH - 8
      : rect.bottom + 8;

    movePopupWithinViewport(popup, rect.left, top);
  }

  function updatePopupBody(def) {
    if (!popupEl) return;
    const body = popupEl.querySelector('.vocab-popup-body');
    const phonetic = popupEl.querySelector('.vocab-popup-phonetic');

    if (def.error) {
      body.innerHTML = `<div class="vocab-popup-error">${def.error}</div>`;
      keepPopupInViewport(popupEl);
      return;
    }

    if (phonetic) phonetic.textContent = def.phonetic || '';

    body.innerHTML = `
      <div class="vocab-popup-definition">${def.definition || ''}</div>
      ${def.example ? `<div class="vocab-popup-example">${def.example}</div>` : ''}
    `;
    keepPopupInViewport(popupEl);
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
    // The selection icon handles its own clicks
    if (selectionIconEl && selectionIconEl.contains(e.target)) return;
    // Do not close on clicks inside the popup
    if (popupEl && popupEl.contains(e.target)) return;
    // onWordClick handles clicks on vocabulary spans
    if (e.target.classList.contains('vocab-word')) return;

    // An active selection means mouseup just opened the icon; the following click should not close it.
    if (window.getSelection()?.toString().trim()) return;

    removeSelectionIcon();
    removePopup();
  }

  // ── Marking operations ───────────────────────────────────────────────────────────

  // Walk up from node to a block-level ancestor and return context containing word.
  function getBlockAncestorText(node, word) {
    if (!node) return '';
    const blockTags = new Set(['p','div','li','td','th','article','section','blockquote','dd','dt','h1','h2','h3','h4','h5','h6','pre','figcaption']);
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const wordLower = word.toLowerCase();
    // Try the immediate parent's text first
    while (el && el !== document.body) {
      if (blockTags.has(el.tagName.toLowerCase())) break;
      el = el.parentElement;
    }
    if (!el || el === document.body) el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
    const text = el?.textContent || '';
    if (text.toLowerCase().indexOf(wordLower) !== -1) return text;
    // If not found in the block element, try one level higher
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

    // For multi-word phrases, if an exact match fails, search each word in order to handle intervening content.
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
        // Anchor at the first word and extract through the end of the last word.
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
    // Find a block-level ancestor with the full sentence; the immediate parent may be too narrow for context.
    const blockTags = new Set(['p','div','li','td','th','article','section','blockquote','dd','dt','h1','h2','h3','h4','h5','h6','pre','figcaption']);
    let el = span.parentElement;
    while (el && el !== document.body) {
      if (blockTags.has(el.tagName.toLowerCase())) break;
      el = el.parentElement;
    }
    if (!el || el === document.body) el = span.parentElement;
    const parentText = el?.textContent || '';
    // If the word is absent from the current block, try one level higher.
    if (parentText.toLowerCase().indexOf(word.toLowerCase()) === -1 && el?.parentElement) {
      const upperText = el.parentElement.textContent || '';
      if (upperText.toLowerCase().indexOf(word.toLowerCase()) !== -1) {
        return extractSentenceAround(upperText, word);
      }
    }
    return extractSentenceAround(parentText, word);
  }

  function getContext(span) {
    // Extract the containing sentence as context
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
    learningRegexCache = null; // Vocabulary changed; rebuild the regex

    if (status === 'mastered') {
      // Remove all underlines for this word
      document.querySelectorAll(`.vocab-word[data-word="${word}"]`).forEach(el => {
        const text = document.createTextNode(el.textContent);
        el.parentNode.replaceChild(text, el);
      });
    } else if (status === 'learning') {
      // Full rescan: restore existing spans before rebuilding so word spans do not split phrases.
      processNode(document.body, true);
    }

    removePopup();
  }

  async function saveExample(word, span) {
    const context = getContext(span);
    await chrome.runtime.sendMessage({ type: 'MARK_WORD', word, status: wordStatus[word]?.status || 'learning', context });

    // Show a save confirmation
    const actions = popupEl?.querySelector('.vocab-popup-actions');
    if (actions) {
      const tip = document.createElement('div');
      tip.className = 'vocab-popup-saved-tip';
      tip.textContent = 'Example saved ✓';
      popupEl.insertBefore(tip, actions);
      setTimeout(() => tip.remove(), 1500);
    }
  }

  // ── Lookup from selection ───────────────────────────────────────────────────────────

  function isEnglishPage() {
    const lang = (document.documentElement.lang || '').toLowerCase();
    if (lang) return lang.startsWith('en');
    // Sample page text to detect the language when lang is absent
    const sample = (document.body?.innerText || '').replace(/\s+/g, '').slice(0, 400);
    if (!sample) return false;
    const nonAscii = (sample.match(/[^\x00-\x7F]/g) || []).length;
    return nonAscii / sample.length < 0.1;
  }

  function onDblClickWord(e) {
    // Cancel single-click delay to prevent flickering
    if (wordClickTimer) { clearTimeout(wordClickTimer); wordClickTimer = null; }

    // Do not interfere with interactions inside the popup
    if (popupEl && popupEl.contains(e.target)) return;
    if (selectionIconEl && selectionIconEl.contains(e.target)) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText) return;

    // Handle only a single English word
    if (!/^[a-zA-Z][a-zA-Z'-]{1,29}$/.test(selectedText)) return;

    const normalizedWord = selectedText.toLowerCase();

    let rect;
    try {
      rect = selection.getRangeAt(0).getBoundingClientRect();
    } catch { return; }
    if (!rect || rect.width === 0) return;

    // Extract the containing sentence as context, preferring a block-level ancestor that includes the target word.
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
      // getBoundingClientRect may return width=0 for multi-line selections; use the last clientRect instead.
      if (!rect || rect.width === 0) {
        const rects = range.getClientRects();
        if (rects.length > 0) rect = rects[rects.length - 1];
      }
    } catch (e) { return; }
    if (!rect || rect.width === 0) return;

    // English words (including hyphens) and English phrases (up to 6 words): look up definitions.
    const isWord = /^[a-zA-Z][a-zA-Z'-]{1,29}$/.test(selectedText);
    const isEnPhrase = !isWord && /^[a-zA-Z][a-zA-Z' -]*[a-zA-Z]$/.test(selectedText) && selectedText.split(/\s+/).length <= 6;
    if (isWord || isEnPhrase) {
      const normalizedWord = selectedText.toLowerCase().replace(/\s+/g, ' ');
      if (wordStatus[normalizedWord]?.status === 'learning') return;
      // Get context from a block-level ancestor that includes the target word.
      const contextText = getBlockAncestorText(selection?.anchorNode, normalizedWord);
      const capturedContext = {
        sentence: extractSentenceAround(contextText, normalizedWord),
        url: location.href,
        date: new Date().toISOString().slice(0, 10),
      };
      showSelectionIcon('word', rect, () => showSelectionPopup(normalizedWord, rect, capturedContext));
    } else if (selectedText.length >= 4) {
      // Check whether selected text itself is English, rather than the page language, to avoid false triggers on Chinese pages.
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
        <button class="vocab-btn-refresh" title="Look Up Again with AI">🔄</button>
      </div>
      <div class="vocab-popup-body">
        <div class="vocab-popup-loading">Looking up...</div>
      </div>
      <div class="vocab-popup-actions">
        <button class="vocab-btn vocab-btn-learn" title="Save to Vocabulary">📌 Vocabulary</button>
        <button class="vocab-btn vocab-btn-master" title="Mark as Mastered">✓ Mastered</button>
      </div>
    `;
    document.body.appendChild(popupEl);
    enablePopupDrag(popupEl);
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
      popupEl.querySelector('.vocab-popup-body').innerHTML = '<div class="vocab-popup-loading">Looking up...</div>';
      chrome.runtime.sendMessage({ type: 'GET_DEFINITION', word, context: context.sentence }).then(def => {
        currentDef = def;
        updatePopupBody(def);
      });
    };
    popupEl.querySelector('.vocab-btn-refresh').addEventListener('click', doAiFetch);

    // Show the cached definition if present; otherwise call AI automatically
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
        <div class="vocab-popup-loading">Translating...</div>
      </div>
      <div class="vocab-popup-actions">
        <button class="vocab-btn vocab-btn-learn">📌 Vocabulary</button>
        <button class="vocab-btn vocab-btn-master">✓ Mastered</button>
      </div>
    `;
    popupEl.addEventListener('click', e => e.stopPropagation());
    document.body.appendChild(popupEl);
    enablePopupDrag(popupEl);
    positionPopupByRect(selectionRect);

    const context = { sentence: extractSentenceAround(surroundingText || text, normalizedPhrase), url: location.href, date: new Date().toISOString().slice(0, 10) };
    const savePhrase = async (status) => {
      await markWord(normalizedPhrase, status, null, context);
      // Fetch and store the definition asynchronously (markWord has completed, so saveDefinition can find the word).
      chrome.runtime.sendMessage({ type: 'GET_DEFINITION', word: normalizedPhrase, context: context.sentence });
    };
    popupEl.querySelector('.vocab-btn-learn').addEventListener('click', () => savePhrase('learning'));
    popupEl.querySelector('.vocab-btn-master').addEventListener('click', () => savePhrase('mastered'));

    const translationPopup = popupEl;
    chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text, context: surroundingText })
      .then(result => {
        if (popupEl !== translationPopup) return;
        const body = translationPopup.querySelector('.vocab-popup-body');
        if (result.error) {
          body.innerHTML = `<div class="vocab-popup-error">${result.error}</div>`;
          positionPopupByRect(selectionRect);
          return;
        }
        const phrasesHtml = (result.phrases || []).map((p, i) => `
          <div class="vocab-phrase-row" data-idx="${i}">
            <span class="vocab-phrase-en">${escHtml(p.en)}</span>
            <span class="vocab-phrase-zh">${escHtml(p.zh)}</span>
            <button class="vocab-phrase-pin" data-phrase="${escHtml(p.en)}" title="Save to Vocabulary">📌</button>
          </div>
        `).join('');

        body.innerHTML = `
          <div class="vocab-popup-translation">${escHtml(result.translation)}</div>
          ${phrasesHtml ? `<div class="vocab-phrases">${phrasesHtml}</div>` : ''}
        `;

        // Bind phrase pin buttons
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
            // Fetch and save definitions asynchronously in the background without interrupting interaction.
            chrome.runtime.sendMessage({ type: 'GET_DEFINITION', word: phrase, context: extractSentenceAround(text, phrase) });
            // Keep the popup open so the user can select other phrases.
          });
        });

        // Reposition after content and height increase
        positionPopupByRect(selectionRect);
      });
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Storage change listener (Gist sync / actions on other pages) ─────────────────────────

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.words) return;
    const newWords = changes.words.newValue || {};
    const oldWords = changes.words.oldValue || {};

    // Remove underlines for words deleted or changed to mastered.
    for (const word of Object.keys(oldWords)) {
      const wasLearning = oldWords[word]?.status === 'learning';
      const nowGone = !newWords[word] || newWords[word].status !== 'learning';
      if (wasLearning && nowGone) {
        document.querySelectorAll(`.vocab-word[data-word="${word}"]`).forEach(el => {
          el.replaceWith(document.createTextNode(el.textContent));
        });
      }
    }

    // Update local cache
    wordStatus = newWords;
    learningRegexCache = null;

    // Find newly learning words and scan the page to underline them.
    const newlyLearning = Object.keys(newWords).filter(
      w => newWords[w]?.status === 'learning' && oldWords[w]?.status !== 'learning'
    );
    if (newlyLearning.length > 0) {
      processNode(document.body, true);
    }
  });

  // ── Startup ───────────────────────────────────────────────────────────────

  init();
})();
