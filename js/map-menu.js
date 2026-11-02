/* ==========================================================================
   階段 9F-1：手機海圖「精簡模式」與「更多」選單（js/map-menu.js）
   * 精簡模式：直向手機（寬 ≤ 599）且「實際可用高度」≤ 720 時，在 #screen-map 加上 .is-compact（離開門檻 736，遲滯 16px，避免網址列伸縮時來回閃動）。
     實際可用高度 = visualViewport.height（沒有就用 innerHeight）；不看螢幕標稱尺寸。使用者用手指放大（visualViewport.scale > 1）時不重新判斷，維持原狀。
     切換只換一個 class，不重建畫面；目前選取的島記在 SeaMap.state.current，這個檔完全不碰它。
   * 「更多」：冒險日誌、我的帳號、班級、玩法指南、登出五顆按鈕的入口。選單項目在「打開當下」讀原按鈕是否可見（hidden 屬性），
     開著的時候也會跟著原按鈕的 hidden 變化更新；點擊時關閉選單、把焦點交給「更多」，再對原按鈕呼叫 click()——不複製任何功能的邏輯。
   * 帳號提醒橫幅避讓（9F-1 補修）：橫幅（9B-2，舊帳號才有，固定貼底）出現時，一般版面與精簡版面的操作區都停在橫幅上方，不被蓋住；見 bannerSync。
   * 沒有網路呼叫、沒有瀏覽器儲存、沒有 innerHTML 寫入後端文字（選單文字來自固定標籤，或原按鈕自己的文字節點）。
   ========================================================================== */
const MapMenu = (function () {
  'use strict';
  const ENTER_H = 720, LEAVE_H = 736, MAX_W = 599, SEA_MARGIN = 0;   /* SEA_MARGIN：橫幅出現、操作區固定時，操作區之上的空間要比「最深的島嶼中心到海面底端的距離」多出的餘裕（px）；0 表示剛好放得進中心點就維持固定（「進入島嶼」一進畫面就看得到比多看一點海面重要） */
  const S = { compact: false, raf: 0, obs: null, bound: false, bh: 0 };
  const ITEMS = [
    { src: 'btn-history', icon: 'book', label: function () { return '冒險日誌'; } },
    { src: 'btn-account', icon: 'crew', label: function () { return '我的帳號'; } },
    { src: 'btn-class', icon: 'teacher', label: function () { const f = byId('btn-class-full'); const t = f ? String(f.textContent || '').trim() : ''; return t || '班級'; } },
    { src: 'btn-guide', icon: 'compass', label: function () { return '玩法指南'; } },
    { src: 'btn-logout', icon: 'logout', label: function () { return '登出'; } }
  ];
  function byId(id) { return document.getElementById(id); }
  function screen() { return byId('screen-map'); }
  function overlay() { return byId('map-more'); }

  /* ---------- 判斷是否精簡 ---------- */
  function viewport() {
    const vv = window.visualViewport;
    const de = document.documentElement || {};
    const w = window.innerWidth || de.clientWidth || 0;
    const h = (vv && vv.height) ? vv.height : (window.innerHeight || de.clientHeight || 0);
    return { w: w, h: h, scale: (vv && vv.scale) ? vv.scale : 1 };
  }
  function decide(vp, was) {
    if (vp.scale > 1.01) return was;                               /* 手指放大中：可用高度不是真的變矮，維持原狀 */
    if (!(vp.w > 0 && vp.h > 0) || vp.w > MAX_W || vp.h <= vp.w) return false;   /* 只處理直向手機 */
    return was ? vp.h < LEAVE_H : vp.h <= ENTER_H;
  }
  function sync() {
    S.raf = 0;
    const scr = screen(); if (!scr) return;
    const next = decide(viewport(), S.compact);
    if (next === S.compact) { refreshMore(); bannerSync(); return; }
    S.compact = next;
    scr.classList.toggle('is-compact', next);
    if (!next && isOpen()) close(byId('btn-history'));            /* 離開精簡模式：選單關掉，焦點交給現在看得到的「冒險日誌」 */
    refreshMore(); bannerSync();
    try { if (typeof SeaMap !== 'undefined' && SeaMap.layout && scr.classList.contains('active')) SeaMap.layout(); } catch (e) { /* 只是重新量位置；失敗不影響使用 */ }
  }
  function schedule() {
    if (S.raf) return;
    S.raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(sync) : (sync(), 0);
  }
  /* ---------- 帳號提醒橫幅（階段 9B-2，固定在畫面底部）：操作區要停在橫幅上方，不能被它蓋住（9F-1 補修：一般版面也適用） ----------
     橫幅（#sp-banner）是舊帳號（沒有 PIN）才會出現的提醒，position:fixed、貼著畫面底部；9E-2 的一般版面（例如 390×844、平板、桌機）會蓋住「進入島嶼」的下緣。
     這裡量橫幅現在占多高（橫幅本身的高度＋它離畫面底部的距離，含 8px 空隙與安全區），寫進 --mm-banner，並在 #screen-map 加上 has-banner；
     CSS 讓操作區（.sm-panel）固定在畫面底部、底部留白加上這個高度，橫幅就疊在那塊留白上，按鈕都在橫幅上方。
     橫幅出現／隱藏／展開／收合、畫面寬度改變造成文字換行、字級改變，都會重新量；沒有橫幅時完全不加任何東西，版面與 9E-2 相同。
     學生不必關掉提醒就能繼續玩；畫面實在太矮時整個畫面可以捲動，捲到底就能看到所有內容（操作區在最後面，不會有永遠被固定區塊蓋住的部分）。 */
  function bannerSync() {
    const scr = screen(); if (!scr) return;
    const b = byId('sp-banner'); let h = 0;
    if (b && !b.hidden && typeof getComputedStyle === 'function') {
      const cs = getComputedStyle(b);
      if (cs.display !== 'none') h = Math.max(0, Math.round(b.getBoundingClientRect().height + (parseFloat(cs.bottom) || 0)));   /* 橫幅本身的高度＋它離畫面底部的距離（8px＋安全區）；不依賴可視視窗的大小，網址列伸縮、手指放大都不影響 */
    }
    if (!scr.classList || !scr.style || typeof scr.style.setProperty !== 'function' || typeof scr.style.removeProperty !== 'function') return;   /* 沒有真正 DOM 的環境（純 Node 測試殼）略過 */
    scr.classList.toggle('has-banner', h > 0);
    if (h > 0) scr.style.setProperty('--mm-banner', h + 'px'); else scr.style.removeProperty('--mm-banner');
    /* 操作區（加上橫幅留白後）如果高到讓海面在它上方的空間，連島嶼的中心都放不進去，固定在底部就會讓島嶼永遠被蓋住（例如橫放的手機）；
       這時改成不固定（banner-flow），跟著內容捲動——捲到哪裡都看得到全部內容，「進入島嶼」在最後面、橫幅上方。
       判斷：操作區之上的空間 < 「六座島裡中心離海面底端最遠的那一座的距離」（SEA_MARGIN = 0）。（距離只看版面，與捲動位置、選哪座島無關。）
       固定時，--mm-panelh 讓鍵盤移動焦點（Tab 到島嶼）時瀏覽器會把焦點元素捲到操作區上方，而不是停在被操作區蓋住的位置。 */
    let flow = false, ph = 0;
    if (h > 0) {
      const pn = byId('sm-panel'), sea = byId('sm-sea');
      if (pn && sea) {
        const phf = pn.getBoundingClientRect().height; ph = Math.round(phf);
        const sb = sea.getBoundingClientRect().bottom; let need = 0;
        sea.querySelectorAll('.sm-island').forEach(function (el) { const r = el.getBoundingClientRect(); need = Math.max(need, sb - (r.top + r.height / 2)); });
        flow = (scr.clientHeight - phf) < need + SEA_MARGIN;
      }
    }
    scr.classList.toggle('banner-flow', flow);
    if (h > 0 && !flow && ph > 0) scr.style.setProperty('--mm-panelh', ph + 'px'); else scr.style.removeProperty('--mm-panelh');
    if (h !== S.bh) {                                                /* 操作區高度變了：只是重新量位置（小船、航線）；失敗不影響使用 */
      S.bh = h;
      try { if (typeof SeaMap !== 'undefined' && SeaMap.layout && scr.classList.contains('active')) SeaMap.layout(); } catch (e) { /* ignore */ }
    }
  }
  function bannerWatch() {
    if (typeof MutationObserver !== 'function') return;
    let bo = null, ro = null;
    function attach() {
      const b = byId('sp-banner'); if (!b || bo) return;
      bo = new MutationObserver(function () { bannerSync(); });
      bo.observe(b, { attributes: true, attributeFilter: ['hidden', 'data-collapsed', 'style', 'class'], childList: true, subtree: true, characterData: true });
      if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(function () { bannerSync(); }); ro.observe(b); const pn = byId('sm-panel'); if (pn) ro.observe(pn); }   /* 橫幅或操作區變高變矮（文字換行、字級、選另一座島）都會重新量 */   /* 文字換行、字級改變讓橫幅變高變矮時也會更新 */
      bannerSync();
    }
    const scr = screen();      /* 橫幅的 CSS 要等海圖畫面是 .active 才顯示；畫面切換（class 改變）時也重新量 */
    if (scr) new MutationObserver(function () { bannerSync(); }).observe(scr, { attributes: true, attributeFilter: ['class'] });
    attach();
    if (!bo && document.body) { const wo = new MutationObserver(function () { if (byId('sp-banner')) { attach(); wo.disconnect(); } }); wo.observe(document.body, { childList: true, subtree: true });   /* 橫幅由 student-pin.js 在需要時才建立；找到就停止監看 */ }
  }
  /* 「更多」按鈕只在精簡模式顯示 */
  function refreshMore() {
    const b = byId('btn-more'); if (b) b.hidden = !S.compact;
  }

  /* ---------- 選單 ---------- */
  function isOpen() { const o = overlay(); return !!(o && o.__open); }
  function srcVisible(el) { return !!el && !el.hidden && !el.hasAttribute('hidden'); }
  function iconOf(name) { return (typeof UIKit !== 'undefined' && UIKit.icon) ? UIKit.icon(name, { size: 26 }) : ''; }
  function fill() {
    const list = byId('mm-list'); if (!list) return 0;
    list.textContent = '';
    let n = 0;
    ITEMS.forEach(function (it) {
      const src = byId(it.src); if (!srcVisible(src)) return;
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ds-btn ds-btn--ghost ds-btn--sm mm-item'; b.setAttribute('data-src', it.src);
      b.insertAdjacentHTML('afterbegin', iconOf(it.icon));          /* 圖示是固定的 SVG；文字用 textContent，不經過 HTML 解析 */
      const t = document.createElement('span'); t.textContent = it.label(); b.appendChild(t);
      b.addEventListener('click', function () { choose(it.src); });
      li.appendChild(b); list.appendChild(li); n++;
    });
    const empty = byId('mm-empty'); if (empty) empty.hidden = n > 0;
    return n;
  }
  function open() {
    const o = overlay(); if (!o || o.__open || !S.compact) return;
    fill(); watch(true);
    UIKit.openDialog(o, byId('btn-more'));
  }
  function close(focusTo) {
    const o = overlay(); if (!o || !o.__open) return;
    watch(false);
    if (focusTo) o.__trigger = focusTo;
    UIKit.closeDialog(o);
  }
  function choose(srcId) {
    const src = byId(srcId);
    const more = byId('btn-more');
    close(more && !more.hidden ? more : null);                      /* 先關選單、焦點回「更多」，這樣被開啟的功能關閉時，焦點會回到看得見的「更多」 */
    if (src && srcVisible(src) && typeof src.click === 'function') src.click();
  }
  /* 選單開著時，原按鈕的 hidden 改變（例如登入狀態更新）→ 重建選單，保持顯示條件一致 */
  function watch(on) {
    if (S.obs) { S.obs.disconnect(); S.obs = null; }
    if (!on || typeof MutationObserver !== 'function') return;
    S.obs = new MutationObserver(function () { if (isOpen()) fill(); });
    ITEMS.forEach(function (it) { const el = byId(it.src); if (el) S.obs.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
    const full = byId('btn-class-full'); if (full) S.obs.observe(full, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    if (S.bound) return; S.bound = true;
    const more = byId('btn-more'); if (more) more.addEventListener('click', open);
    const ov = overlay();
    if (ov) ov.addEventListener('mousedown', function (e) {          /* 點背景關閉時，瀏覽器在關閉後才處理焦點，會掉到 body；補一次，讓焦點回到「更多」 */
      if (e.target !== ov) return;
      setTimeout(function () { const m = byId('btn-more'); if (!isOpen() && m && !m.hidden && (!document.activeElement || document.activeElement === document.body)) m.focus({ preventScroll: true }); }, 0);
    });
    const cl = byId('mm-close'); if (cl) cl.addEventListener('click', function () { close(); });
    if (typeof window.addEventListener === 'function') {            /* 沒有視窗事件的環境（例如純 Node 測試殼）略過綁定 */
      window.addEventListener('resize', schedule);
      window.addEventListener('orientationchange', schedule);
    }
    try { if (window.visualViewport) { window.visualViewport.addEventListener('resize', schedule); } } catch (e) { /* 舊瀏覽器沒有 visualViewport */ }
    bannerWatch();
    sync();
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }

  return {
    ENTER_H: ENTER_H, LEAVE_H: LEAVE_H, MAX_W: MAX_W, SEA_MARGIN: SEA_MARGIN, ITEMS: ITEMS, state: S,
    isCompact: function () { return S.compact; }, isOpen: isOpen, open: open, close: close, sync: sync, decide: decide
  };
})();
