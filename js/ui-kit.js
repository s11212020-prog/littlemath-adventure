/* ==========================================================================
   《小小算術家：六島大冒險》UI Kit（階段 3）
   - 一組原創圖示（同一種圓潤、墨藍描邊、琺瑯色塊風格；不用 emoji、不混用外部圖示）
   - 視覺元件只「接收狀態」並回傳畫面，不會讀寫學生的星星或進度
   - 圖示可被替換：UIKit.useImages({ star: 'assets/icons/star.svg' })，不必改任何功能程式
   只定義全域物件 UIKit；階段 3 只有 design-system.html 載入它，主程式尚未使用。
   ========================================================================== */
const UIKit = (function () {
  'use strict';

  /* ---------- 1. 圖示（viewBox 48×48；顏色用 class，對應 components.css 內的 tokens） ---------- */
  const ICONS = {
    /* 方向與導航 */
    back:     '<path class="c-sea" d="M27 9 8 22l19 13v-7h12a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H27z"/><path class="ns c-deep-s" d="M6 42q4-4 8 0t8 0 8 0 8 0 8 0"/>',
    next:     '<path class="c-coral" d="M7 31h34l-6 9H13z"/><path d="M24 7v24"/><path class="c-surface" d="M22 11v18H10z"/><path class="c-sun" d="M26 13v16h12z"/>',
    map:      '<path class="c-surface" d="M5 12l12-4 14 4 12-4v28l-12 4-14-4-12 4z"/><path d="M17 8v28M31 12v28"/><path class="ns c-coral-s" d="M10 30q5-8 10-2t9-8"/><path class="c-coral" d="m33 20 5 5m0-5-5 5"/>',
    compass:  '<circle class="c-surface" cx="24" cy="24" r="18"/><circle class="c-sea" cx="24" cy="24" r="12" fill-opacity=".35"/><path class="c-coral" d="m31 17-5 9-9 5 5-9z"/><circle class="c-ink" cx="24" cy="24" r="2"/><path d="M24 4v4M24 40v4M4 24h4M40 24h4"/>',
    home:     '<path class="c-surface" d="M8 22 24 8l16 14v18H8z"/><path class="c-coral" d="M5 23 24 6l19 17"/><rect class="c-sun" x="20" y="28" width="9" height="12" rx="2"/><path class="ns" d="M4 43h40"/>',
    /* 內容 */
    book:     '<path class="c-deep" d="M6 10h15a3 3 0 0 1 3 3v28a3 3 0 0 0-3-3H6z"/><path class="c-surface" d="M42 10H27a3 3 0 0 0-3 3v28a3 3 0 0 1 3-3h15z"/><path class="ns" d="M29 18h8M29 24h8M29 30h6"/><path class="c-coral" d="M12 10v13l3-2 3 2V10"/>',
    bottle:   '<path class="c-pale" d="M19 14h10v6c5 3 7 7 7 12v6a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4v-6c0-5 2-9 7-12z"/><rect class="c-wood" x="19" y="5" width="10" height="9" rx="2"/><path class="c-sun" d="m24 24 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z"/>',
    hint:     '<path class="c-pale" d="M24 5C14 5 8 12 8 20c0 6 3 9 6 12v7a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-7c3-3 6-6 6-12 0-8-6-15-16-15z"/><path class="c-sun" d="M18 30c-3-3-4-5-4-8a10 10 0 0 1 20 0c0 3-1 5-4 8z"/><path d="M19 36h10M20 41h8"/>',
    gear:     '<g class="c-deep"><rect x="21" y="3" width="6" height="9" rx="2"/><rect x="21" y="36" width="6" height="9" rx="2"/><rect x="3" y="21" width="9" height="6" rx="2"/><rect x="36" y="21" width="9" height="6" rx="2"/><rect x="21" y="3" width="6" height="9" rx="2" transform="rotate(45 24 24)"/><rect x="21" y="36" width="6" height="9" rx="2" transform="rotate(45 24 24)"/><rect x="3" y="21" width="9" height="6" rx="2" transform="rotate(45 24 24)"/><rect x="36" y="21" width="9" height="6" rx="2" transform="rotate(45 24 24)"/></g><circle class="c-sea" cx="24" cy="24" r="14"/><circle class="c-surface" cx="24" cy="24" r="6"/>',
    lock:     '<path class="c-surface" d="M15 21v-6a9 9 0 0 1 18 0v6"/><rect class="c-sun" x="10" y="21" width="28" height="21" rx="6"/><circle class="c-ink" cx="24" cy="30" r="3"/><path d="M24 31v5"/>',
    cloud:    '<path class="c-white" d="M14 38a9 9 0 0 1-1-18 12 12 0 0 1 23 2 8 8 0 0 1-1 16z"/><path class="ns c-line-s" d="M17 31q3-3 6 0M26 27q3-3 6 0"/>',
    /* 進度與成就 */
    star:     '<path class="c-sun" d="m24 5 5.6 12 13 1.6-9.6 9 2.6 12.9L24 33.6 12.4 40.5 15 27.6l-9.6-9 13-1.6z"/><path class="ns c-white-s" d="M18 14l3-3"/>',
    'star-empty': '<path class="c-surface dash" d="m24 5 5.6 12 13 1.6-9.6 9 2.6 12.9L24 33.6 12.4 40.5 15 27.6l-9.6-9 13-1.6z"/>',
    crown:    '<path class="c-sun" d="m7 36-2-20 11 9 8-14 8 14 11-9-2 20z"/><rect class="c-gold" x="7" y="36" width="34" height="6" rx="2"/><circle class="c-coral" cx="24" cy="31" r="2.6"/><circle class="c-sea" cx="14" cy="32" r="2"/><circle class="c-mint" cx="34" cy="32" r="2"/>',
    lighthouse:'<path class="c-sea" d="M4 43q6-5 10 0t10 0 10 0 10 0"/><path class="c-surface" d="m17 41 3-24h8l3 24z"/><path class="c-coral" d="m19 29 .6-6h8.8l.6 6zM18 37l.6-5h10.8l.6 5z"/><rect class="c-ink" x="18" y="11" width="12" height="7" rx="2"/><circle class="c-sun" cx="24" cy="14.5" r="2.4"/><path class="c-coral" d="m17 11 7-7 7 7z"/>',
    check:    '<circle class="c-mint" cx="24" cy="24" r="19"/><path class="ns" stroke-width="5" d="m14 25 7 7 14-15"/>',
    close:    '<circle class="c-surface" cx="24" cy="24" r="19"/><path class="ns" stroke-width="5" d="m16 16 16 16m0-16L16 32"/>',
    retry:    '<path class="ns" stroke-width="5" d="M38 24a14 14 0 1 1-4.5-10.3"/><path class="c-sun" d="m37 6-1 11-11-1z"/>',
    /* 聲音與設定 */
    sound:    '<path class="c-sun" d="M6 19h8l10-9v28l-10-9H6z"/><path class="ns" d="M31 17q4 7 0 14M36 12q8 12 0 24"/>',
    mute:     '<path class="c-line" d="M6 19h8l10-9v28l-10-9H6z"/><path class="ns" d="m32 18 10 12m0-12L32 30"/>',
    replay:   '<path class="ns" stroke-width="4.5" d="M9 24a15 15 0 1 0 4.5-10.7"/><path class="c-sea" d="m7 6 1 12 12-1z"/><path class="c-surface" d="m20 17 11 7-11 7z"/>',
    skip:     '<path class="c-sea" d="m7 10 17 14L7 38z"/><path class="c-coral" d="m24 10 17 14-17 14z"/>',
    captions: '<rect class="c-surface" x="4" y="9" width="40" height="30" rx="8"/><path class="ns" d="M12 21h10M26 21h10M12 29h4M20 29h16"/>',
    /* 人 */
    crew:     '<circle class="c-skin" cx="24" cy="26" r="12"/><path class="c-deep" d="M10 22q0-14 14-14t14 14z"/><rect class="c-surface" x="8" y="20" width="32" height="5" rx="2.5"/><circle class="c-ink" cx="19" cy="29" r="1.6"/><circle class="c-ink" cx="29" cy="29" r="1.6"/><path class="ns" d="M20 34q4 3 8 0"/>',
    teacher:  '<rect class="c-mint" x="5" y="8" width="38" height="26" rx="5"/><path class="ns c-white-s" d="M12 16h14M12 22h10"/><path class="c-sun" d="M30 30l11-11 4 4-11 11-5 1z"/><path d="M13 43h22"/>',
    chart:    '<path class="ns" d="M6 6v36h36"/><rect class="c-sea" x="12" y="24" width="7" height="14" rx="2"/><rect class="c-sun" x="23" y="14" width="7" height="24" rx="2"/><rect class="c-coral" x="34" y="20" width="7" height="18" rx="2"/>',
    /* 動作 */
    refresh:  '<path class="ns" stroke-width="4.5" d="M39 20A15 15 0 0 0 11 17M9 28a15 15 0 0 0 28 3"/><path class="c-sea" d="m40 7-1 13-13-1zM8 41l1-13 13 1z"/>',
    logout:   '<path class="c-surface" d="M8 6h18v36H8z"/><circle class="c-ink" cx="21" cy="24" r="2"/><path class="ns" d="M30 24h13m-5-6 6 6-6 6"/>',
    download: '<path class="ns" stroke-width="4" d="M24 6v24"/><path class="c-sea" d="m13 22 11 12 11-12z"/><path class="c-surface" d="M6 36h36v7H6z"/>',
    filter:   '<path class="c-sea" d="M5 8h38L29 25v14l-10 4V25z"/>',
    warn:     '<path class="c-sun" d="M24 5 44 41H4z"/><path class="ns" stroke-width="4" d="M24 17v12"/><circle class="c-ink" cx="24" cy="35" r="2.2"/>',
    info:     '<circle class="c-sea" cx="24" cy="24" r="19"/><circle class="c-ink" cx="24" cy="15" r="2.6"/><path class="ns" stroke-width="4.5" d="M24 22v13"/>',
    /* 運算與題型 */
    plus:     '<circle class="c-mint" cx="24" cy="24" r="19"/><path class="ns" stroke-width="5" d="M24 13v22M13 24h22"/>',
    minus:    '<circle class="c-coral" cx="24" cy="24" r="19"/><path class="ns" stroke-width="5" d="M13 24h22"/>',
    times:    '<circle class="c-sun" cx="24" cy="24" r="19"/><path class="ns" stroke-width="5" d="m15 15 18 18m0-18L15 33"/>',
    divide:   '<circle class="c-pink" cx="24" cy="24" r="19"/><path class="ns" stroke-width="5" d="M13 24h22"/><circle class="c-ink" cx="24" cy="14" r="2.8"/><circle class="c-ink" cx="24" cy="34" r="2.8"/>',
    story:    '<path class="c-violet" d="M8 8h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H26l-9 8v-8H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"/><path class="ns c-white-s" stroke-width="3.5" d="M19 17a5 5 0 1 1 7 4.5c-2 1-2 2-2 3.5"/><circle class="c-white" cx="24" cy="28" r="1.6" stroke-width="0"/>',
    parens:   '<circle class="c-deep" cx="24" cy="24" r="19"/><path class="ns c-white-s" stroke-width="4" d="M19 12q-8 12 0 24M29 12q8 12 0 24"/>'
  };

  /* 若之後提供更精緻的 PNG / WebP / SVG，登記在這裡即可（名稱不變，不用改功能程式） */
  const IMAGE_OVERRIDES = {};
  function useImages(map) { Object.keys(map || {}).forEach(function (k) { IMAGE_OVERRIDES[k] = map[k]; }); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** 回傳圖示 HTML。有 label → 視為有意義的圖片（role=img + aria-label）；沒有 → 純裝飾（aria-hidden）。 */
  function icon(name, opt) {
    opt = opt || {};
    const size = opt.size ? ' style="width:' + opt.size + 'px;height:' + opt.size + 'px"' : '';
    const a11y = opt.label ? ' role="img" aria-label="' + esc(opt.label) + '"' : ' aria-hidden="true"';
    const cls = 'ds-icon' + (opt.className ? ' ' + opt.className : '');
    if (IMAGE_OVERRIDES[name]) return '<img class="' + cls + '" src="' + esc(IMAGE_OVERRIDES[name]) + '" alt="' + esc(opt.label || '') + '"' + size + ' draggable="false">';
    const body = ICONS[name];
    if (!body) return '<span class="' + cls + ' ds-icon--missing"' + size + a11y + '></span>';
    return '<svg class="' + cls + '" viewBox="0 0 48 48" focusable="false"' + a11y + size + '>' + body + '</svg>';
  }

  /** 把 <i data-icon="star" data-label="星星" data-size="28"> 這類佔位元素換成真正的圖示。 */
  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      const html = icon(el.getAttribute('data-icon'), { size: el.getAttribute('data-size'), label: el.getAttribute('data-label'), className: el.getAttribute('data-class') });
      const t = document.createElement('span'); t.innerHTML = html; const node = t.firstChild;
      if (node) el.replaceWith(node);
    });
  }

  /* ---------- 2. ProgressStars：只接收數字 ---------- */
  function starsHTML(count, max, opt) {
    opt = opt || {}; max = max || 3; count = Math.max(0, Math.min(max, Math.floor(count || 0)));
    let s = '';
    for (let i = 0; i < max; i++) s += icon(i < count ? 'star' : 'star-empty', { className: 'ds-stars__star ' + (i < count ? 'is-on' : 'is-off') });
    const label = opt.label || ('已獲得 ' + count + ' 顆星，共 ' + max + ' 顆');
    return '<span class="ds-stars" role="img" aria-label="' + esc(label) + '">' + s + '</span>';
  }

  /* ---------- 3. LighthouseState：只接收「完成幾個區域」(0–3) 與是否有星冠 ---------- */
  function lighthouseHTML(lit, opt) {
    opt = opt || {}; lit = Math.max(0, Math.min(3, Math.floor(lit || 0)));
    const label = opt.label || ('燈塔：已點亮 ' + lit + ' 層，共 3 層' + (opt.crown ? '，已獲得金色星冠' : ''));
    const win = function (i, y) { return '<rect class="ds-lh__win' + (lit > i ? ' is-lit' : '') + '" x="27" y="' + y + '" width="10" height="8" rx="4"/>'; };
    return '<svg class="ds-lh" data-lit="' + lit + '" viewBox="0 0 64 100" role="img" aria-label="' + esc(label) + '" focusable="false">' +
      '<path class="ds-lh__beam' + (lit === 3 ? ' is-on' : '') + '" d="M32 30 -4 18v24zM32 30l36-12v24z"/>' +
      '<path class="ds-lh__rock" d="M4 96q8-10 16-9h24q8-1 16 9z"/>' +
      '<path class="ds-lh__tower" d="M16 88 24 36h16l8 52z"/>' +
      '<path class="ds-lh__band" d="M22.15 48H41.85L42.77 54H21.23zM19.7 64H44.3L45.2 70H18.8z"/>' +
      win(0, 73) + win(1, 57) + win(2, 41) +
      '<rect class="ds-lh__room" x="24" y="24" width="16" height="12" rx="3"/>' +
      '<circle class="ds-lh__lamp' + (lit === 3 ? ' is-lit' : '') + '" cx="32" cy="30" r="4"/>' +
      '<path class="ds-lh__roof" d="M21 24 32 12l11 12z"/>' +
      (opt.crown ? '<path class="ds-lh__crown" d="m25 11-2-9 6 4 3-6 3 6 6-4-2 9z"/>' : '') +
      '</svg>';
  }

  /* ---------- 4. 載入狀態 ---------- */
  function setLoading(btn, on, text) {
    if (!btn) return;
    if (on) {
      if (btn.__lbl == null) btn.__lbl = btn.innerHTML;
      btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); btn.setAttribute('aria-disabled', 'true');
      btn.innerHTML = '<span class="ds-spinner" aria-hidden="true"></span><span>' + esc(text || '載入中…') + '</span>';
    } else if (btn.__lbl != null) {
      btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); btn.removeAttribute('aria-disabled');
      btn.innerHTML = btn.__lbl; btn.__lbl = null;
    }
  }

  /* ---------- 5. Dialog / BottomSheet：焦點陷阱、Esc 關閉、關閉後回到觸發物件 ---------- */
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const openStack = [];
  function openDialog(overlay, trigger) {
    if (!overlay || overlay.__open) return;
    overlay.__open = true; overlay.__trigger = trigger || document.activeElement;
    overlay.hidden = false; overlay.removeAttribute('hidden');
    overlay.classList.add('is-open');
    const panel = overlay.querySelector('[role="dialog"],[role="alertdialog"]') || overlay;
    const first = panel.querySelector('[data-autofocus]') || panel.querySelector(FOCUSABLE) || panel;
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    setTimeout(function () { first.focus({ preventScroll: true }); }, 0);
    overlay.__key = function (e) {
      if (openStack[openStack.length - 1] !== overlay) return;
      if (e.key === 'Escape') { e.preventDefault(); closeDialog(overlay); return; }
      if (e.key !== 'Tab') return;
      const f = Array.prototype.filter.call(panel.querySelectorAll(FOCUSABLE), function (n) { return n.offsetParent !== null; });
      if (!f.length) { e.preventDefault(); panel.focus(); return; }
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === panel)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    overlay.__click = function (e) { if (e.target === overlay && overlay.getAttribute('data-modal') !== 'strict') closeDialog(overlay); };
    document.addEventListener('keydown', overlay.__key, true); overlay.addEventListener('mousedown', overlay.__click);
    openStack.push(overlay);
  }
  function closeDialog(overlay) {
    if (!overlay || !overlay.__open) return;
    overlay.__open = false; overlay.classList.remove('is-open'); overlay.hidden = true;
    document.removeEventListener('keydown', overlay.__key, true); overlay.removeEventListener('mousedown', overlay.__click);
    const i = openStack.indexOf(overlay); if (i >= 0) openStack.splice(i, 1);
    const t = overlay.__trigger; if (t && t.focus && document.contains(t)) t.focus({ preventScroll: true });
  }

  return { version: '1.0.0', ICONS: ICONS, icon: icon, hydrate: hydrate, useImages: useImages, starsHTML: starsHTML, lighthouseHTML: lighthouseHTML, setLoading: setLoading, openDialog: openDialog, closeDialog: closeDialog };
})();
