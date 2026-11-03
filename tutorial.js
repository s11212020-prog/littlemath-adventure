/* ==========================================================================
   階段 8.1：新手航海導覽（Coach Mark／Spotlight）
   - 純前端顯示層：只「讀」目前進度；不呼叫任何 API、不改 currentUser.progress／total_stars、不新增紀錄、不解鎖區域、不點亮燈塔。
   - 「看過」只記在這台裝置的 localStorage（鍵：mathIslandTutorial:v1:學生識別值，值只有 "1"）；不寫 Google Sheet、不寫進度 JSON。
   - 自動出現：總星數 0、沒有任何學習紀錄、本裝置沒看過、已選好船員並進入海圖。已有星星／紀錄的學生不會被強制播放。
   - 9F-3a 導覽修正：只有成功啟動才算用掉這次自動檢查；條件還沒好時最多重試約 1 秒（10 次 × 100ms，不留計時器）；登出、離開海圖、換學生都會取消等待。「看過」紀錄有 user_id 時只用 user_id。Tutorial.state.why 記錄最後一次自動檢查的結果（只在記憶體，除錯用）。
   - 「玩法指南」按鈕隨時可重播（不改看過紀錄）。
   - 亮框位置全部用 getBoundingClientRect() 即時計算（視窗改變、旋轉、捲動、海圖滑動、縮放、安全區變動都會重算），沒有寫死座標。
   - 導覽用的「示範港口」只是把真正的港口視窗打開來看（唯讀）；結束或跳過一定會關閉，並把 selectedIslandForModal 還原。
   ========================================================================== */
const Tutorial = (function () {
  'use strict';
  const VERSION = 'v1';
  const KEY_PREFIX = 'mathIslandTutorial:' + VERSION + ':';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const ic = function (name, size) { try { return UIKit.icon(name, { size: size || 24 }); } catch (e) { return ''; } };

  const OPENING = '小船員，歡迎來到六島大冒險！跟著航海指南看看怎麼開始吧！';
  /* 規則數字（3／5／10 題；70%／90%／20%；9／54 顆星）和 js/questions.js 的實際規則一致，測試會比對原始碼 */
  const ISLAND_NAMES = ['加法島', '減法島', '乘法島', '除法島', '應用題島', '四則運算島'];

  /* ---------- 八個步驟（文字依規格；target 用函式即時取得真實畫面上的元素） ---------- */
  const STEPS = [
    { id: 'welcome', title: '歡迎來到六島大冒險！', lead: OPENING,
      main: '你可以自由選擇想挑戰的數學島。完成各區任務，收集星星、點亮燈塔，提升你的航海稱號！', target: null },
    { id: 'island', title: '選一座島出發', main: '點擊島嶼，小船就會帶你前往島上的挑戰港口。六座島都可以自由選擇！',
      more: { label: '詳細說明', html: function () { return '<ul class="tt-chips">' + ISLAND_NAMES.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'; } },
      target: function () { return $('node-add'); }, interactive: true, map: true },
    { id: 'zones', title: '一座島有三個學習區', main: '請依序完成「概念學習、互動練習、掌握確認」。前一區過關，下一區才會開放。',
      extra: function () { return '<ul class="tt-zones"><li><b>概念學習區</b><span>先看概念動畫，再完成 3 題。</span></li><li><b>互動練習區</b><span>完成學習區後開放，共 5 題。</span></li><li><b>掌握確認區</b><span>完成練習區後開放，共 10 題。</span></li></ul>'; },
      more: { label: '詳細說明', html: function () { return '<ul class="tt-list"><li>學習區隨時可以進入。</li><li>學習區至少得到 1 顆星，才開放互動練習區。</li><li>互動練習區至少得到 1 顆星，才開放掌握確認區。</li><li>不用拿到 3 顆星才能前進。</li></ul>'; } },
      target: function () { return rectOfAll('#modal-actions .zp-zone'); }, port: true },
    { id: 'learn', title: '先理解，再練習', main: '進入概念學習區後，先看動畫和字幕，再開始回答問題。',
      main2: '第一次答錯不用擔心，系統會一步一步提供提示。訂正正確後，才能進入下一題。',
      extra: function () { return demoHTML(); },
      more: { label: '詳細說明', html: function () { return '<ul class="tt-list"><li>第一次答錯：提示 1。</li><li>再次答錯：提示 2。</li><li>再次答錯：提示 3。</li><li>一定要完成訂正，不能直接跳過題目。</li><li>電腦可以使用 Enter 送出答案或進入下一題。</li></ul>'; } },
      target: function () { return document.querySelector('#modal-actions .zp-zone[data-zone="LEARNING"]'); }, port: true },
    { id: 'stars', title: '完成挑戰，收集星星', main: '每完成一個區域，至少可以獲得 1 顆星。第一次答對越多、使用提示越少，就有機會得到 2 顆或 3 顆星！',
      more: { label: '查看詳細規則', html: function () { return '<ul class="tt-list"><li>完成全部題目並完成訂正：1 顆星。</li><li>首次答對率至少 70%：2 顆星。</li><li>首次答對率至少 90%，提示使用率不超過 20%：3 顆星。</li><li>每區最多 3 顆，每島最多 9 顆，六島最多 54 顆。</li><li>重玩成績較差，不會扣掉原本最高的星數。</li></ul>'; } },
      target: function () { return statOf('stars-add'); }, map: true },
    { id: 'lighthouse', title: '完成一區，點亮一盞燈', main: '一個區域過關，就會點亮一盞燈。三個區域都過關，整座島的三盞燈就會全部亮起！',
      more: { label: '詳細說明', html: function () { return '<ul class="tt-list"><li>概念學習區過關：第一盞燈。</li><li>互動練習區過關：第二盞燈。</li><li>掌握確認區過關：第三盞燈。</li><li>一座島收集到 9 顆星時，會出現最高榮譽效果。</li></ul>'; } },
      target: function () { return unionOf([$('lh-add'), statOf('lhc-add')]); }, map: true },
    { id: 'title', title: '星星越多，稱號越高', main: '收集總星星可以提升航海稱號。點擊這裡，就能查看現在的位置和所有未來稱號！',
      more: { label: '稱號路線', open: 'wide', html: function () { return routeListHTML(); } },
      button: { id: 'tt-open-route', label: '查看完整稱號航線', icon: 'map' },
      target: function () { return $('btn-title-route'); }, interactive: true, map: true },
    { id: 'journal', title: '到冒險日誌看看成長', main: '完成挑戰後，可以在冒險日誌查看各島各區的完成時間、答對率和獲得星星。',
      extra: function () { return (typeof MapMenu !== 'undefined' && MapMenu.isCompact()) ? '<p class="tt-main">冒險日誌收在畫面下方的「更多」裡面。</p>' : ''; },
      closing: '準備好了嗎？選一座島開始冒險吧！',
      target: function () { const h = $('btn-history'); if (visible(h)) return h; const m = $('btn-more'); return visible(m) ? m : h; }, map: true }
  ];

  const S = { active: false, step: 0, mode: 'auto', trigger: null, demoPort: false, prevSelected: '', prevIsland: null, autoFor: null, pend: null, why: '', raf: false, layoutMode: '', root: null, bound: false };

  /* ---------- 看過紀錄（只用 localStorage；失敗就當成沒看過，不影響使用） ---------- */
  function ids() {
    /* 9F-3a 導覽修正：有 user_id 就只用 user_id（新帳號即使登入代碼和以前用過的相同，user_id 不同就是不同學生）；
       只有舊帳號確實沒有 user_id 時，才用 username 當備援。不刪除、不改寫任何既有的 localStorage 紀錄。 */
    const u = currentUser || {};
    if (u.user_id && u.id_status !== 'temporary') return [String(u.user_id)];   /* 示範／離線模式的臨時編號（TMP_）每次登入都不同，不能當紀錄鍵：這種情況改用 username */
    if (u.username) return [String(u.username)];
    return [];
  }
  function keyFor(id) { return KEY_PREFIX + id; }
  function hasSeen() { try { return ids().some(function (id) { return localStorage.getItem(keyFor(id)) === '1'; }); } catch (e) { return false; } }
  function markSeen() { try { ids().forEach(function (id) { localStorage.setItem(keyFor(id), '1'); }); } catch (e) { /* 無痕模式或被封鎖：略過 */ } }
  function hasAnyRecord() {
    const p = (currentUser && currentUser.progress) || {};
    return Object.keys(p).some(function (isl) {
      const z = p[isl]; if (!z || typeof z !== 'object') return false;
      return Object.keys(z).some(function (k) { return Array.isArray(z[k]) && z[k].length > 0; });
    });
  }
  function totalStars() { try { return ProgressSystem.calcTotal((currentUser && currentUser.progress) || {}); } catch (e) { return 0; } }
  function shouldAuto() {
    if (!currentUser || !currentUser.progress || !currentUser.progress.avatar) return false;
    if (totalStars() !== 0 || Number(currentUser.total_stars) > 0 || hasAnyRecord()) return false;
    const m = $('screen-map'); if (!m || !m.classList.contains('active')) return false;
    return !hasSeen();
  }
  /* 自動播放的三種判斷結果：'go'＝現在就播；'wait'＝條件還沒準備好（稍後再看，有次數上限）；'no'＝這位學生不該自動播（有星星／有紀錄／看過） */
  function autoState(last) {
    if (!currentUser) return 'no';
    if (totalStars() !== 0 || Number(currentUser.total_stars) > 0 || hasAnyRecord() || hasSeen()) return 'no';
    if (!currentUser.progress || !currentUser.progress.avatar) return 'wait';               /* 角色還沒存好 */
    const m = $('screen-map'); if (!m || !m.classList.contains('active')) return 'wait';    /* 海圖還沒顯示 */
    if (!last && !visible($('node-add'))) return 'wait';                                    /* 海圖上的島還沒畫好；最後一次不再等，直接播（目標找不到時導覽會用置中卡片） */
    return 'go';
  }

  /* ---------- 取得真實畫面上的位置 ---------- */
  function visible(el) { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function toRect(r) { return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.right - r.left, height: r.bottom - r.top }; }
  function unionOf(els) {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, n = 0;
    els.forEach(function (e) { if (!visible(e)) return; const q = e.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); n++; });
    return n ? { el: els.filter(visible)[0], rect: toRect({ left: l, top: t, right: r, bottom: b }) } : null;
  }
  function rectOfAll(sel) { return unionOf(Array.prototype.slice.call(document.querySelectorAll(sel))); }
  function statOf(id) { const e = $(id); return e && e.closest ? e.closest('.sm-stat') : null; }
  function resolveTarget(step) {
    if (!step || !step.target) return null;
    let t = null; try { t = step.target(); } catch (e) { t = null; }
    if (!t) return null;
    if (t.rect) return t;                         /* 已經是 {el, rect}（多個元素的聯集） */
    if (!visible(t)) return null;
    return { el: t, rect: toRect(t.getBoundingClientRect()) };
  }
  function reduced() {
    try { const de = document.documentElement; if (de && de.classList.contains('reduce-motion')) return true; } catch (e) { /* 測試環境 */ }
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  /* 手機瀏海／Home 指示條：讀 CSS 的 --safe-*（env(safe-area-inset-*)）實際算出的像素 */
  function safeInsets() {
    let p = $('tt-probe');
    if (!p) { p = document.createElement('div'); p.id = 'tt-probe'; p.setAttribute('aria-hidden', 'true'); p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:var(--safe-top,0px) var(--safe-right,0px) var(--safe-bottom,0px) var(--safe-left,0px)'; document.body.appendChild(p); }
    const c = getComputedStyle(p); const n = function (v) { return parseFloat(v) || 0; };
    return { t: n(c.paddingTop), r: n(c.paddingRight), b: n(c.paddingBottom), l: n(c.paddingLeft) };
  }
  function viewport() { const de = document.documentElement; return { w: de.clientWidth || window.innerWidth, h: window.innerHeight || de.clientHeight }; }

  /* ---------- 小型示範插畫（第 4 步；原創，不是真的題目、不會送出任何東西） ---------- */
  function demoHTML() {
    return '<div class="tt-demo" aria-hidden="true"><div class="tt-demo__stage">' + ic('story', 34) + '<span>動畫＋字幕</span></div><span class="tt-demo__go">' + ic('next', 26) + '</span>' +
      '<div class="tt-demo__q"><b>5 ＋ 3 ＝ ？</b><span class="tt-demo__box">？</span><span class="tt-demo__hint">' + ic('hint', 22) + '提示 1</span></div></div>';
  }
  function routeListHTML() {
    const L = (typeof ProgressSystem !== 'undefined' && ProgressSystem.TITLE_LEVELS) || [];
    return '<ol class="tt-route">' + L.map(function (x) { return '<li><b>' + x.min + ' 星</b><span>' + esc(x.title) + '</span></li>'; }).join('') + '</ol>';
  }

  /* ---------- DOM（第一次需要時才建立，平常是隱藏的） ---------- */
  function build() {
    if (S.root) return S.root;
    const root = document.createElement('div'); root.id = 'tutorial-root'; root.className = 'tt-root'; root.hidden = true;
    root.innerHTML =
      '<div class="tt-dim" id="tt-dim"></div>' +
      '<div class="tt-spot" id="tt-spot" hidden></div>' +
      '<div class="tt-blk" data-pos="t"></div><div class="tt-blk" data-pos="b"></div><div class="tt-blk" data-pos="l"></div><div class="tt-blk" data-pos="r"></div><div class="tt-blk tt-cover" id="tt-cover" hidden></div>' +
      '<svg class="tt-arrow" id="tt-arrow" aria-hidden="true" focusable="false"><defs><marker id="tt-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#FFD166" stroke="#17324D" stroke-width="1.4" stroke-linejoin="round"/></marker></defs><path id="tt-arrow-path" d="" fill="none" stroke="#17324D" stroke-width="8" stroke-linecap="round" stroke-dasharray="1 14" opacity=".0"/><path id="tt-arrow-line" d="" fill="none" stroke="#FFD166" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 11" marker-end="url(#tt-head)"/></svg>' +
      '<section class="tt-card" id="tt-card" role="dialog" aria-modal="true" aria-labelledby="tt-title" aria-describedby="tt-body">' +
        '<div class="tt-card__top"><span class="tt-card__badge" aria-hidden="true">' + ic('compass', 22) + '新手航海導覽</span><span class="tt-stepno" id="tt-stepno"></span></div>' +
        '<div class="tt-dots" id="tt-dots" aria-hidden="true"></div>' +
        '<p class="tt-lead" id="tt-lead" hidden></p>' +
        '<h2 class="tt-title" id="tt-title" tabindex="-1"></h2>' +
        '<div class="tt-body" id="tt-body"></div>' +
        '<div class="tt-actions"><button type="button" class="ds-btn ds-btn--ghost ds-btn--sm" id="tt-prev">上一步</button><button type="button" class="ds-btn ds-btn--coral ds-btn--sm" id="tt-next">下一步</button><button type="button" class="ds-btn ds-btn--link ds-btn--sm tt-skip" id="tt-skip">跳過導覽</button></div>' +
      '</section>' +
      '<div class="ds-sr-only" id="tt-live" role="status" aria-live="polite"></div>';
    document.body.appendChild(root);
    const cf = document.createElement('div'); cf.id = 'tt-confirm'; cf.className = 'ds-overlay tt-confirm'; cf.hidden = true; cf.setAttribute('data-modal', 'strict');
    cf.innerHTML = '<div class="ds-dialog" role="alertdialog" aria-modal="true" aria-labelledby="tt-confirm-title"><h2 class="ds-dialog__title" id="tt-confirm-title">要先跳過嗎？</h2><p class="ds-dialog__body">之後可以按「玩法指南」再看一次。</p><div class="ds-dialog__actions"><button type="button" class="ds-btn ds-btn--ghost" id="tt-confirm-no" data-autofocus>繼續導覽</button><button type="button" class="ds-btn ds-btn--coral" id="tt-confirm-yes">確定跳過</button></div></div>';
    document.body.appendChild(cf);
    S.root = root;
    $('tt-prev').addEventListener('click', prev); $('tt-next').addEventListener('click', next); $('tt-skip').addEventListener('click', askSkip);
    $('tt-confirm-no').addEventListener('click', function () { try { UIKit.closeDialog($('tt-confirm')); } catch (e) { /* 測試環境 */ } });
    $('tt-confirm-yes').addEventListener('click', function () { try { UIKit.closeDialog($('tt-confirm')); } catch (e) { /* 測試環境 */ } finish(true); });
    return root;
  }

  /* ---------- 示範港口（真正的港口視窗，唯讀） ---------- */
  function portOpen() { const o = $('modal-report'); return !!(o && o.style.display === 'flex'); }
  function openDemoPort() {
    if (portOpen()) { S.demoPort = true; return; }
    S.prevSelected = (typeof selectedIslandForModal !== 'undefined') ? selectedIslandForModal : '';
    try { showIslandModal('加法島'); S.demoPort = true; } catch (e) { S.demoPort = false; }
  }
  function closeDemoPort() {
    if (!S.demoPort && !portOpen()) return;
    try { IslandUI.closePort(true); } catch (e) { /* 測試環境 */ }
    try { selectedIslandForModal = S.prevSelected || ''; } catch (e) { /* 測試環境 */ }
    S.demoPort = false;
  }

  /* ---------- 版面：亮框、遮罩、說明卡、箭頭 ---------- */
  function subOpen() { return !!(($('tt-confirm') && $('tt-confirm').__open) || (typeof TitleRoute !== 'undefined' && TitleRoute.isOpen())); }

  function scrollIntoAvail(el, top, bottom) {   /* 目標不在可視範圍時，把最近的可捲動外層捲到合適位置（不改任何資料） */
    try {
      let n = el.parentElement, guard = 0;
      while (n && n !== document.documentElement && guard++ < 12) {
        const cs = getComputedStyle(n); const oy = cs.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
          const r = el.getBoundingClientRect(); let d = 0;
          if (r.top < top) d = r.top - top; else if (r.bottom > bottom) d = Math.min(r.bottom - bottom, r.top - top);
          if (d) n.scrollTop += d;
        }
        n = n.parentElement;
      }
    } catch (e) { /* 失敗就維持原位置 */ }
  }

  function placeCard(card, tgt, vp, ins) {
    const m = 12; const cw0 = Math.min(430, vp.w - 2 * m - ins.l - ins.r);
    card.className = card.className.replace(/\s*tt-card--(sheet|side|float|center)/g, '');
    card.style.cssText = '';
    let mode = 'float';
    if (vp.w < 600) mode = 'sheet'; else if (vp.h < 500) mode = 'side';
    if (!tgt) { mode = vp.w < 600 ? 'sheet' : 'center'; }
    if (mode === 'sheet') {
      const maxH = Math.round((vp.h < 520 ? .62 : .46) * vp.h);
      card.classList.add('tt-card--sheet'); card.style.maxHeight = maxH + 'px';
      let atTop = false;
      if (tgt) {
        const ch = Math.min(card.offsetHeight, maxH);
        scrollIntoAvail(tgt.el || document.body, ins.t + 8, vp.h - ch - ins.b - 16);
        const t2 = resolveTarget(S.cur) || tgt; tgt = t2;
        if (tgt.rect.bottom > vp.h - ch - ins.b - 8 && tgt.rect.top - ins.t > ch + 16) atTop = true;
      }
      if (atTop) { card.style.top = (ins.t + 8) + 'px'; card.style.bottom = 'auto'; card.classList.add('tt-card--top'); }
      return tgt;
    }
    if (mode === 'center') { card.classList.add('tt-card--center'); card.style.width = cw0 + 'px'; card.style.maxHeight = (vp.h - 2 * m - ins.t - ins.b) + 'px'; return tgt; }
    if (mode === 'side') {   /* 手機橫向／很矮的視窗：卡片放在目標的另一側，可上下捲動 */
      card.classList.add('tt-card--side'); const w = Math.min(380, Math.round(vp.w * .42));
      const onLeft = tgt ? (tgt.rect.left + tgt.rect.width / 2) > vp.w / 2 : false;
      card.style.width = w + 'px'; card.style.top = (ins.t + m) + 'px'; card.style.bottom = (ins.b + m) + 'px'; card.style.maxHeight = 'none';
      if (onLeft) card.style.left = (ins.l + m) + 'px'; else card.style.right = (ins.r + m) + 'px';
      return tgt;
    }
    /* float：桌機／平板——依序試「下方、右側、左側、上方」，放得下才用；都放不下就當成底部卡片 */
    card.classList.add('tt-card--float'); card.style.width = cw0 + 'px';
    const ch = card.offsetHeight, cw = card.offsetWidth, r = tgt.rect, gap = 40;
    const minX = ins.l + m, maxX = vp.w - ins.r - m - cw, minY = ins.t + m, maxY = vp.h - ins.b - m - ch;
    const clampX = function (x) { return Math.max(minX, Math.min(maxX, x)); }, clampY = function (y) { return Math.max(minY, Math.min(maxY, y)); };
    const cands = [
      { ok: r.bottom + gap + ch <= vp.h - ins.b - m, x: clampX(r.left + r.width / 2 - cw / 2), y: r.bottom + gap },
      { ok: r.right + gap + cw <= vp.w - ins.r - m, x: r.right + gap, y: clampY(r.top + r.height / 2 - ch / 2) },
      { ok: r.left - gap - cw >= minX, x: r.left - gap - cw, y: clampY(r.top + r.height / 2 - ch / 2) },
      { ok: r.top - gap - ch >= minY, x: clampX(r.left + r.width / 2 - cw / 2), y: r.top - gap - ch }
    ];
    const pick = cands.filter(function (c) { return c.ok; })[0];
    if (pick) { card.style.left = pick.x + 'px'; card.style.top = pick.y + 'px'; }
    else { card.classList.remove('tt-card--float'); card.classList.add('tt-card--sheet'); card.style.width = ''; card.style.maxHeight = Math.round(.46 * vp.h) + 'px'; }
    return tgt;
  }

  function drawArrow(card, tgt, vp) {
    const line = $('tt-arrow-line'), shadow = $('tt-arrow-path'), svg = $('tt-arrow'); if (!line || !svg) return;
    svg.setAttribute('width', vp.w); svg.setAttribute('height', vp.h); svg.setAttribute('viewBox', '0 0 ' + vp.w + ' ' + vp.h);
    if (!tgt) { line.setAttribute('d', ''); shadow.setAttribute('d', ''); return; }
    const c = toRect(card.getBoundingClientRect()), r = tgt.rect;
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2, tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    const edge = function (b, px, py, toX, toY, pad) {   /* 從矩形中心朝 (toX,toY) 走，停在矩形外框外 pad 像素 */
      const dx = toX - px, dy = toY - py; if (!dx && !dy) return { x: px, y: py };
      const sx = dx ? ((b.width / 2 + pad) / Math.abs(dx)) : Infinity, sy = dy ? ((b.height / 2 + pad) / Math.abs(dy)) : Infinity; const s = Math.min(sx, sy);
      return { x: px + dx * s, y: py + dy * s };
    };
    const a = edge(c, cx, cy, tx, ty, 2), z = edge(r, tx, ty, cx, cy, 12);
    const len = Math.hypot(z.x - a.x, z.y - a.y);
    if (len < 16) { line.setAttribute('d', ''); shadow.setAttribute('d', ''); return; }
    const mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2, nx = -(z.y - a.y) / len, ny = (z.x - a.x) / len, bend = Math.min(40, len * .2);
    const d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'Q' + (mx + nx * bend).toFixed(1) + ' ' + (my + ny * bend).toFixed(1) + ' ' + z.x.toFixed(1) + ' ' + z.y.toFixed(1);
    line.setAttribute('d', d); shadow.setAttribute('d', d);
  }

  function layout() {
    if (!S.active) return;
    const root = S.root, card = $('tt-card'); if (!root || !card) return;
    const vp = viewport(), ins = safeInsets(); const step = STEPS[S.step]; S.cur = step;
    let tgt = null;
    try { tgt = resolveTarget(step); } catch (e) { tgt = null; }
    try { tgt = placeCard(card, tgt, vp, ins); } catch (e) { console.error('[tutorial]', e); tgt = null; card.className = 'tt-card tt-card--center'; card.style.cssText = ''; }
    const spot = $('tt-spot'), dim = $('tt-dim'), cover = $('tt-cover'); const blks = root.querySelectorAll('.tt-blk:not(.tt-cover)');
    S.hasTarget = !!tgt;
    if (!tgt) {       /* 沒有目標（第 1 步，或找不到元素）：整片遮罩＋畫面中央的一般說明卡，仍可上一步、下一步、跳過 */
      spot.hidden = true; cover.hidden = true; dim.hidden = false;
      for (let i = 0; i < blks.length; i++) { const b = blks[i]; b.style.cssText = 'left:0;top:0;width:100%;height:100%'; if (blks[i].dataset.pos !== 't') b.style.display = 'none'; }
      drawArrow(card, null, vp); return;
    }
    dim.hidden = true; spot.hidden = false;
    const pad = 8, r = tgt.rect; const L = Math.max(0, r.left - pad), T = Math.max(0, r.top - pad), R = Math.min(vp.w, r.right + pad), B = Math.min(vp.h, r.bottom + pad);
    const rad = Math.max(10, Math.min(26, Math.min(R - L, B - T) / 3));
    spot.style.cssText = 'left:' + L + 'px;top:' + T + 'px;width:' + (R - L) + 'px;height:' + (B - T) + 'px;border-radius:' + rad + 'px';
    for (let i = 0; i < blks.length; i++) {
      const b = blks[i], k = b.dataset.pos; b.style.display = '';
      if (k === 't') b.style.cssText = 'left:0;top:0;width:100%;height:' + T + 'px';
      else if (k === 'b') b.style.cssText = 'left:0;top:' + B + 'px;width:100%;height:' + Math.max(0, vp.h - B) + 'px';
      else if (k === 'l') b.style.cssText = 'left:0;top:' + T + 'px;width:' + L + 'px;height:' + (B - T) + 'px';
      else b.style.cssText = 'left:' + R + 'px;top:' + T + 'px;width:' + Math.max(0, vp.w - R) + 'px;height:' + (B - T) + 'px';
    }
    if (step.interactive) { cover.hidden = true; }      /* 亮框裡面的真實按鈕可以直接點 */
    else { cover.hidden = false; cover.style.cssText = 'left:' + L + 'px;top:' + T + 'px;width:' + (R - L) + 'px;height:' + (B - T) + 'px'; }
    drawArrow(card, tgt, vp);
  }
  function schedule() { if (S.raf || !S.active) return; S.raf = true; const f = function () { S.raf = false; layout(); }; if (window.requestAnimationFrame) window.requestAnimationFrame(f); else setTimeout(f, 16); }

  /* ---------- 步驟內容 ---------- */
  function renderStep() {
    const step = STEPS[S.step]; const n = STEPS.length; const last = S.step === n - 1;
    $('tt-stepno').textContent = '第 ' + (S.step + 1) + '／' + n + ' 步';
    $('tt-dots').innerHTML = STEPS.map(function (_, i) { return '<i class="' + (i === S.step ? 'is-on' : (i < S.step ? 'is-done' : '')) + '"></i>'; }).join('');
    const lead = $('tt-lead'); lead.hidden = !step.lead; lead.textContent = step.lead || '';
    $('tt-title').textContent = step.title;
    let h = '<p class="tt-main">' + esc(step.main) + '</p>';
    if (step.main2) h += '<p class="tt-main">' + esc(step.main2) + '</p>';
    if (step.extra) h += step.extra();
    if (step.button) h += '<p class="tt-btnrow"><button type="button" class="ds-btn ds-btn--deep ds-btn--sm" id="' + step.button.id + '">' + ic(step.button.icon, 24) + esc(step.button.label) + '</button></p>';
    if (step.more) { const open = step.more.open === 'wide' && viewport().w >= 600 && viewport().h >= 640; h += '<details class="tt-more"' + (open ? ' open' : '') + '><summary>' + esc(step.more.label) + '</summary>' + step.more.html() + '</details>'; }
    if (step.closing) h += '<p class="tt-closing">' + ic('lighthouse', 26) + esc(step.closing) + '</p>';
    $('tt-body').innerHTML = h;
    const nx = $('tt-next'); nx.innerHTML = last ? ic('lighthouse', 24) + '開始冒險' : '下一步'; nx.classList.toggle('ds-btn--gold', last);
    const pv = $('tt-prev'); pv.hidden = S.step === 0;
    const ob = $('tt-open-route'); if (ob) ob.addEventListener('click', function () { try { TitleRoute.open(ob); } catch (e) { /* 失敗就維持在這一步 */ } });
    $('tt-live').textContent = '';
    $('tt-live').textContent = '第 ' + (S.step + 1) + ' 步，共 ' + n + ' 步：' + step.title;
  }
  function prepMap(step) {
    if (!step.map) return;
    try { if (typeof SeaMap !== 'undefined') SeaMap.centerOn(0, true); } catch (e) { /* 失敗就用目前位置 */ }
  }
  function go(i, focus) {
    if (!S.active) return;
    S.step = Math.max(0, Math.min(STEPS.length - 1, i)); const step = STEPS[S.step];
    if (step.port) openDemoPort(); else closeDemoPort();
    prepMap(step);
    renderStep(); layout();
    if (focus !== false) { try { $('tt-title').focus({ preventScroll: true }); } catch (e) { /* 測試環境 */ } }
    layout();
  }
  function next() { if (!S.active) return; if (S.step >= STEPS.length - 1) { finish(true); return; } go(S.step + 1); }
  function prev() { if (!S.active) return; if (S.step > 0) go(S.step - 1); }
  function askSkip() { if (!S.active) return; try { UIKit.openDialog($('tt-confirm'), $('tt-skip')); } catch (e) { finish(true); } }

  /* ---------- 開始／結束 ---------- */
  function start(mode, trigger) {
    if (S.active || !currentUser) return false;
    if (typeof document === 'undefined' || !document.body || !document.documentElement || typeof window.addEventListener !== 'function') return false;   /* 沒有真正的瀏覽器畫面（例如單元測試的假 DOM）：不啟動 */
    const m = $('screen-map'); if (!m || !m.classList.contains('active')) return false;
    try {
      build(); S.active = true; S.mode = mode || 'manual'; S.trigger = trigger || null;
      try { S.prevIsland = (typeof SeaMap !== 'undefined' && SeaMap.state) ? SeaMap.state.current : null; } catch (e) { S.prevIsland = null; }
      S.root.hidden = false; document.documentElement.classList.add('tt-on');
      bindGlobal(); go(0);
      return true;
    } catch (e) {          /* 任何意外都不能讓畫面卡在遮罩上：整個收掉，學生照常玩 */
      console.error('[tutorial]', e); try { teardown(); } catch (e2) { S.active = false; if (S.root) S.root.hidden = true; }
      return false;
    }
  }
  function teardown() {
    S.active = false; S.step = 0;
    try { const c = $('tt-confirm'); if (c && c.__open) UIKit.closeDialog(c); } catch (e) { /* 測試環境 */ }
    try { if (typeof TitleRoute !== 'undefined' && TitleRoute.isOpen()) TitleRoute.close(); } catch (e) { /* 測試環境 */ }
    closeDemoPort();
    if (S.root) S.root.hidden = true; document.documentElement.classList.remove('tt-on');
    try { if (S.prevIsland !== null && typeof SeaMap !== 'undefined' && SeaMap.centerOn) SeaMap.centerOn(S.prevIsland, true); } catch (e) { /* 失敗就維持原位置 */ }
  }
  function finish(mark) {
    if (!S.active) return;
    teardown();
    if (mark) markSeen();   /* 完成最後一步或確認跳過：本裝置記為已看過（重播不會取消已有的紀錄） */
    const g0 = $('btn-guide'), g = visible(g0) ? g0 : $('btn-more'); try { if (g && g.focus) g.focus({ preventScroll: true }); } catch (e) { /* 測試環境 */ }
  }
  function cancelPending() {   /* 取消還沒做完的自動檢查（等待畫面的 requestAnimationFrame、重試用的 100ms 計時器） */
    const p = S.pend; S.pend = null; if (!p) return;
    try { if (p.raf && window.cancelAnimationFrame) window.cancelAnimationFrame(p.raf); } catch (e) { /* 測試環境 */ }
    try { if (p.timer) clearTimeout(p.timer); } catch (e) { /* 測試環境 */ }
  }
  function abort() { cancelPending(); if (S.active) teardown(); }   /* 登出、換畫面：取消等待中的自動檢查、關掉遮罩與示範港口，不記為看過 */

  /* ---------- 全域事件（只綁一次） ---------- */
  function onKey(e) {
    if (!S.active || subOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); askSkip(); return; }
    if (e.key !== 'Tab') return;
    e.stopImmediatePropagation();            /* 不讓港口視窗自己的 Tab 迴圈搶走焦點 */
    const card = $('tt-card'); const f = Array.prototype.filter.call(card.querySelectorAll('button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'), function (n) { return n.offsetParent !== null; });
    const title = $('tt-title'); const list = [title].concat(f); const a = list[0], z = list[list.length - 1], cur = document.activeElement;
    if (!card.contains(cur)) { e.preventDefault(); a.focus(); return; }
    if (e.shiftKey && cur === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && cur === z) { e.preventDefault(); a.focus(); }
  }
  function onClickCapture(e) {   /* 第 2 步：點亮框裡的真實加法島 → 直接打開該島港口，導覽接著介紹三個區域 */
    if (!S.active || STEPS[S.step].id !== 'island') return;
    const t = e.target && e.target.closest ? e.target.closest('#node-add') : null; if (!t) return;
    e.preventDefault(); e.stopPropagation(); go(S.step + 1);
  }
  function onFocusIn(e) {
    if (!S.active || subOpen()) return;
    if (S.root && !S.root.contains(e.target)) { try { $('tt-title').focus({ preventScroll: true }); } catch (x) { /* 測試環境 */ } }
  }
  function bindGlobal() {
    if (S.bound) return; S.bound = true;
    window.addEventListener('keydown', onKey, true);       /* 掛在 window 的捕獲階段：比港口視窗、對話框掛在 document 的鍵盤處理更早收到 Esc／Tab */
    window.addEventListener('resize', schedule); window.addEventListener('orientationchange', schedule);
    window.addEventListener('scroll', schedule, true);
    try { if (window.visualViewport) { window.visualViewport.addEventListener('resize', schedule); window.visualViewport.addEventListener('scroll', schedule); } } catch (e) { /* 舊瀏覽器 */ }
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('click', onClickCapture, true);
  }

  /* ---------- 與其他畫面的接點 ---------- */
  const RETRY_MAX = 10, RETRY_MS = 100;   /* 最多再試 10 次、每次隔 100ms（約 1 秒）；之後放棄，不留任何計時器 */
  function onScreen(id) {
    if (id !== 'screen-map') { abort(); return; }                       /* 離開海圖：取消等待中的檢查，並關掉導覽 */
    if (!currentUser || S.autoFor === currentUser) return;              /* 這次登入已經成功自動播放過了 */
    if (S.pend && S.pend.user === currentUser) return;                  /* 這位學生已經在等了 */
    cancelPending();
    const p = S.pend = { user: currentUser, tries: 0, raf: 0, timer: 0 };
    /* 只有「成功呼叫 start('auto')」才記為這次登入已經自動播放過；條件還沒好就留著機會，稍後再試 */
    const tick = function () {
      p.raf = 0; p.timer = 0;
      if (S.pend !== p) return;                                         /* 已被取消 */
      if (currentUser !== p.user || (($('screen-map') || {}).classList && !$('screen-map').classList.contains('active'))) { cancelPending(); S.why = 'left'; return; }   /* 登出、換學生或離開海圖 */
      let v = 'no';
      try { v = autoState(p.tries >= RETRY_MAX); } catch (e) { console.error('[tutorial]', e); v = 'no'; }
      if (v === 'go') {
        let ok = false; try { ok = start('auto', null); } catch (e) { console.error('[tutorial]', e); }
        if (ok) { S.autoFor = p.user; S.why = 'started'; cancelPending(); return; }
        v = 'wait'; S.why = 'start-failed';
      }
      if (v === 'no') { S.why = 'not-new'; cancelPending(); return; }
      if (p.tries >= RETRY_MAX) { S.why = 'gave-up'; cancelPending(); return; }
      p.tries++; S.why = 'waiting';
      p.timer = setTimeout(tick, RETRY_MS);
    };
    if (window.requestAnimationFrame) p.raf = window.requestAnimationFrame(function () { p.raf = window.requestAnimationFrame(tick); }); else tick();
  }
  function init() {
    const g = $('btn-guide'); if (g) g.addEventListener('click', function () { start('manual', g); });
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }

  return {
    VERSION: VERSION, KEY_PREFIX: KEY_PREFIX, STEPS: STEPS, state: S, keyFor: keyFor, hasSeen: hasSeen, markSeen: markSeen, shouldAuto: shouldAuto,
    start: start, next: next, prev: prev, go: go, askSkip: askSkip, finish: finish, abort: abort, onScreen: onScreen, layout: layout, isActive: function () { return S.active; }
  };
})();
