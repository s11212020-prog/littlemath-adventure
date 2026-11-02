/* 階段 7：裝置相容性（device.js）
   只處理「不同裝置／瀏覽器的差異」，不碰題目、答題、存檔、教師分析的任何邏輯。做四件事：
   1. 虛擬鍵盤：iOS Safari、Android Chrome 的鍵盤是「蓋在網頁上」，網頁高度不變。
      用 visualViewport 量出被蓋住的高度 → --kb 與 html.kb-open（css/compat.css 用它在畫面底部多留空間），
      並在輸入框被鍵盤擋住時，把它捲到鍵盤上方。
   2. 觸控裝置的「基礎題」答案框：畫面上已經有自己的數字鍵盤，所以把 #ui-input 設成 inputmode="none"，
      不會再彈出系統鍵盤把數字鍵盤蓋住（實體鍵盤、藍牙鍵盤照樣能輸入；應用題的答案框仍使用系統數字鍵盤）。
   3. 不支援容器查詢單位 cqw 的舊瀏覽器（Safari 15.x、Chrome 104 以前）：量出容器寬度的 1% 放進 --cqw。
   4. html 加上平台標記（is-ios／is-android／is-webkit／is-touch），方便除錯與日後針對性修正。
   全部包在 try/catch：任何一項失敗都不會影響答題。不用任何固定計時器，也不讀寫任何學生資料。 */
const DeviceCompat = (function () {
  const D = { kb: 0, platform: {}, cqwFallback: false, inputmodeNone: false };
  const w = typeof window !== 'undefined' ? window : null;
  const doc = typeof document !== 'undefined' ? document : null;
  if (!w || !doc || !doc.documentElement || typeof doc.addEventListener !== 'function') return D;
  const html = doc.documentElement;
  const safe = function (fn) { try { return fn(); } catch (e) { return undefined; } };
  const supports = function (prop, val) { return !!safe(function () { return w.CSS && typeof w.CSS.supports === 'function' && w.CSS.supports(prop, val); }); };
  const mq = function (q) { return !!safe(function () { return w.matchMedia && w.matchMedia(q).matches; }); };

  /* ---------- 4. 平台標記 ---------- */
  function detect() {
    const nav = w.navigator || {}; const ua = nav.userAgent || '';
    const iPadOS = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;          // iPadOS 13+ 的 Safari 會假裝成 Mac
    const ios = /iP(hone|od|ad)/.test(ua) || iPadOS;
    const android = /Android/i.test(ua);
    const safariDesktop = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPR\/|Android/.test(ua);
    D.platform = { ios: ios, android: android, webkit: ios || safariDesktop, touch: mq('(pointer: coarse)') || (nav.maxTouchPoints || 0) > 0 };
    const cl = html.classList; if (!cl) return;
    if (ios) cl.add('is-ios'); if (android) cl.add('is-android'); if (D.platform.webkit) cl.add('is-webkit'); if (D.platform.touch) cl.add('is-touch');
  }

  /* ---------- 3. cqw 降級 ---------- */
  function cqwFallback() {
    if (supports('width', '1cqw')) return;
    D.cqwFallback = true; if (html.classList) html.classList.add('no-cqw');
    const SEL = '.sm-scroller, .sm-stop, .ig-theater';
    const measure = function (el) {
      safe(function () {
        const cs = w.getComputedStyle(el); const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const px = el.clientWidth - pad; if (px > 0) el.style.setProperty('--cqw', (px / 100) + 'px');
      });
    };
    const all = function () { Array.prototype.forEach.call(doc.querySelectorAll(SEL), measure); };
    all();
    if (typeof w.ResizeObserver === 'function') {
      const ro = new w.ResizeObserver(function (list) { list.forEach(function (e) { measure(e.target); }); });
      Array.prototype.forEach.call(doc.querySelectorAll(SEL), function (el) { ro.observe(el); });
    }
    if (typeof w.addEventListener === 'function') { w.addEventListener('resize', all); w.addEventListener('orientationchange', all); w.addEventListener('load', all); }
  }

  /* ---------- 2. 基礎題答案框：觸控裝置用畫面上的數字鍵盤 ---------- */
  function keypadInput() {
    const i = doc.getElementById('ui-input'); if (!i || typeof i.setAttribute !== 'function') return;
    if (mq('(pointer: coarse)') && doc.querySelector('.ig-pad')) { i.setAttribute('inputmode', 'none'); D.inputmodeNone = true; }
  }

  /* ---------- 1. 虛擬鍵盤 ---------- */
  const vv = w.visualViewport || null;
  const NOT_TEXT = /^(button|checkbox|radio|submit|reset|range|color|file|image|hidden)$/;
  function editable(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;        // <select> 開的是選單，不是鍵盤
    if (el.tagName === 'INPUT' && NOT_TEXT.test(el.type || 'text')) return false;
    if (el.readOnly || el.disabled) return false;
    return (el.getAttribute && el.getAttribute('inputmode')) !== 'none';           // inputmode="none" 不會跳出鍵盤
  }
  function scroller(el) {
    for (let a = el.parentElement; a && a !== doc.body && a !== html; a = a.parentElement) {
      const cs = w.getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) return a;
    }
    return doc.scrollingElement || html;
  }
  function measureKb() {
    if (!vv) return 0;
    if (vv.scale && vv.scale > 1.02) return 0;                                      // 使用者用兩指放大時 visualViewport 也會變小，不是鍵盤
    const kb = Math.round(w.innerHeight - vv.height); return kb > 0 ? kb : 0;
  }
  function ensureVisible() {
    const el = doc.activeElement; if (!vv || !editable(el)) return;
    const top = vv.offsetTop, bot = vv.offsetTop + vv.height, pad = 10; const r = el.getBoundingClientRect(); const vis = bot - top;
    if (r.top >= top + pad && r.bottom <= bot - pad) return;                        // 已經看得到，不用動（避免和 iOS 自己的捲動打架）
    const sc = scroller(el); const want = top + Math.max(pad, vis * 0.30 - r.height / 2);   // 放在可視範圍偏上，下面留位置給送出鈕
    sc.scrollTop += r.top - want;
  }
  let pending = false;
  function update() {
    const kb = measureKb(); const open = kb >= 120 && editable(doc.activeElement); const v = open ? kb : 0;
    if (v !== D.kb) {
      D.kb = v; html.style.setProperty('--kb', v + 'px');
      if (html.classList) { if (open) html.classList.add('kb-open'); else html.classList.remove('kb-open'); }
    }
    if (open) ensureVisible();
  }
  function schedule() {
    if (pending) return; pending = true; const run = function () { pending = false; safe(update); };
    if (typeof w.requestAnimationFrame === 'function') w.requestAnimationFrame(run); else run();
  }
  function keyboard() {
    if (!vv || typeof vv.addEventListener !== 'function') return;
    vv.addEventListener('resize', schedule); vv.addEventListener('scroll', schedule);
    doc.addEventListener('focusin', schedule); doc.addEventListener('focusout', function () { if (typeof w.requestAnimationFrame === 'function') w.requestAnimationFrame(schedule); else schedule(); });
    w.addEventListener('orientationchange', schedule);
  }

  D.refresh = function () { safe(update); };
  safe(detect);
  const start = function () { safe(cqwFallback); safe(keypadInput); safe(keyboard); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
  return D;
})();
