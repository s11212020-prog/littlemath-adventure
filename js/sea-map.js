/* 階段 5：海上六島地圖控制器
   負責：島嶼狀態（已完成／進行中／尚未開始＋目前停靠）、燈塔與星數、下方面板、航線進度、小船沿航線移動、
         手機 scroll-snap 滑動選島、平板滑鼠拖曳、鍵盤（←／→／Home／End／Tab）、減少動態。
   不負責：進度計算（ProgressSystem、LighthouseSystem 照舊）、題庫、答題紀錄、Google Sheet —— 這些完全沒動。
   不使用固定 setTimeout 當完成訊號：小船到港用 Web Animations 的 finished，捲動到位用 scroll 事件的位置比對。 */
const SeaMap = (function () {
  const ISLANDS = [
    { key: 'add', art: 'add', name: '加法島',     theme: '把兩堆東西合起來，算出一共有多少。' },
    { key: 'sub', art: 'sub', name: '減法島',     theme: '從一堆東西裡拿走一些，算出還剩多少。' },
    { key: 'mul', art: 'mul', name: '乘法島',     theme: '一排一排都一樣多，用乘法一次算出來。' },
    { key: 'div', art: 'div', name: '除法島',     theme: '把東西平均分給大家，每一份剛好一樣多。' },
    { key: 'wp',  art: 'wp',  name: '應用題島',   theme: '從生活故事裡找出數字，決定要怎麼算。' },
    { key: 'ord', art: 'mix', name: '四則運算島', theme: '加、減、乘、除一起上，照順序一步一步算。' }
  ];
  const STATE_TEXT = { done: '已完成', progress: '進行中', 'new': '尚未開始' };
  const STATE_ICON = { done: 'check', progress: 'lighthouse', 'new': 'compass' };
  const S = { user: null, current: 0, infos: [], inited: false, sailing: null, boatXY: null, scrollTarget: null, drag: null, suppressClick: false, downIdx: null, raf: false, lhKey: [], boatKey: null, lastW: 0 };

  const $ = function (id) { return document.getElementById(id); };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const idxOfName = function (name) { for (let i = 0; i < ISLANDS.length; i++) if (ISLANDS[i].name === name) return i; return -1; };

  /* 減少動態：系統偏好 或 手動開關（html.reduce-motion） */
  function reduced() {
    try { const de = document.documentElement; if (de && de.classList && de.classList.contains('reduce-motion')) return true; } catch (e) { /* 沒有 documentElement（測試環境） */ }
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  /* ---------- 1. 每座島目前的狀態（全部由已儲存的進度推導，不另存任何資料） ---------- */
  function infoOf(i) {
    const prog = (currentUser && currentUser.progress) ? currentUser.progress[ISLANDS[i].name] : null;
    const st = LighthouseSystem.deriveState(prog);
    const tried = !!prog && ['LEARNING', 'PRACTICE', 'MASTERY'].some(function (z) { return Array.isArray(prog[z]) && prog[z].length > 0; });
    const state = st.islandIlluminated ? 'done' : ((st.litCount > 0 || tried) ? 'progress' : 'new');
    return { st: st, state: state, lit: st.litCount, stars: st.earnedStars, perfect: st.perfectGlow };
  }
  /* 預設停靠點：航線上第一座還沒完成的島；六座都完成就停在最後一座 */
  function defaultIndex() { for (let i = 0; i < S.infos.length; i++) if (S.infos[i].state !== 'done') return i; return ISLANDS.length - 1; }
  function chipHTML(state) { return UIKit.icon(STATE_ICON[state], { size: 20 }) + STATE_TEXT[state]; }
  function describe(i) {
    const it = ISLANDS[i], inf = S.infos[i];
    return it.name + '，' + STATE_TEXT[inf.state] + '，燈塔 ' + inf.lit + '／3，星星 ' + inf.stars + '／9' + (i === S.current ? '，小船停在這裡' : '');
  }

  /* ---------- 2. 把狀態畫到畫面上 ---------- */
  function paintNodes() {
    ISLANDS.forEach(function (it, i) {
      const el = $('node-' + it.key); if (!el) return; const inf = S.infos[i]; if (!inf) return; const docked = (i === S.current);
      const pop = !!(el.classList && el.classList.contains && el.classList.contains('lh-pop'));
      /* class 名稱沿用舊版（lh-N、island-lit、star-3、lh-perfect、lh-pop），其他程式與測試都靠它們判斷 */
      el.className = 'island-node sm-island isl-' + it.key + ' star-' + (inf.perfect ? 3 : 0) + ' lh-' + inf.lit +
        (inf.st.islandIlluminated ? ' island-lit' : '') + (inf.perfect ? ' lh-perfect' : '') + ' is-' + inf.state + (docked ? ' is-docked' : '') + (pop ? ' lh-pop' : '');
      el.setAttribute('data-state', inf.state); el.setAttribute('data-docked', docked ? 'true' : 'false');
      if (docked) el.setAttribute('aria-current', 'location'); else el.removeAttribute('aria-current');
      el.setAttribute('aria-label', describe(i) + '。按下前往這座島');
      el.title = it.name + '：燈塔 ' + inf.lit + '／3，星星 ' + inf.stars + '／9';
      const stars = $('stars-' + it.key); if (stars) stars.innerText = inf.stars;
      const cnt = $('lhc-' + it.key); if (cnt) cnt.innerText = inf.lit + '/3';
      const chip = $('chip-' + it.key); if (chip) { chip.className = 'sm-chip sm-chip--' + inf.state; chip.innerHTML = chipHTML(inf.state); }
      const lh = $('lh-' + it.key); const lk = inf.lit + (inf.perfect ? 'c' : '');
      if (lh && S.lhKey[i] !== lk) { S.lhKey[i] = lk; lh.innerHTML = '<span aria-hidden="true">' + UIKit.lighthouseHTML(inf.lit, { crown: inf.perfect, label: it.name + '的燈塔' }) + '</span>'; }
    });
  }
  function paintPanel() {
    const i = S.current, it = ISLANDS[i], inf = S.infos[i]; if (!it || !inf) return;
    const set = function (id, k, v) { const e = $(id); if (e) e[k] = v; };
    set('sm-pos', 'innerHTML', '第 <b>' + (i + 1) + '</b>／' + ISLANDS.length + ' 座');
    set('sm-panel-name', 'innerText', it.name);
    const chip = $('sm-panel-chip'); if (chip) { chip.className = 'sm-chip sm-chip--' + inf.state; chip.innerHTML = chipHTML(inf.state); }
    set('sm-panel-stars', 'innerText', '星星 ' + inf.stars + '／9');
    set('sm-panel-lh', 'innerText', '燈塔 ' + inf.lit + '／3');
    set('sm-panel-theme', 'innerText', it.theme);
    const btn = $('sm-enter'); if (btn) btn.setAttribute('aria-label', '進入' + it.name + '（' + STATE_TEXT[inf.state] + '）');
    ISLANDS.forEach(function (x, k) {
      const d = $('dot-' + x.key); if (!d) return;
      d.setAttribute('data-state', S.infos[k].state);
      if (k === S.current) d.setAttribute('aria-current', 'location'); else d.removeAttribute('aria-current');
      d.setAttribute('aria-label', '第 ' + (k + 1) + ' 座：' + describe(k));
    });
  }
  function paintBoat() {
    const boat = $('player-avatar'); if (!boat) return;
    const av = currentUser && currentUser.progress ? currentUser.progress.avatar : null;
    const key = String(av) + (typeof RewardLook !== 'undefined' ? RewardLook.lookKey() : '');   /* 9E-2：本人裝備有變化時才重畫；沒有裝備時鍵和以前相同 */
    if (S.boatKey === key && boat.innerHTML) return; S.boatKey = key;
    const own = (typeof RewardLook !== 'undefined') ? RewardLook.ownBoatInner(av) : null;   /* 不是本人／沒有裝備狀態 → null → 原本的畫法 */
    boat.innerHTML = '<span class="sm-boat__bob">' + (own || (BoatArt.sail() + '<span class="sm-boat__crew">' + AvatarKit.bustHTML(av, 56) + '</span>' + BoatArt.hull())) + '</span>';
  }

  /* ---------- 3. 版面座標：航線與小船都用「島嶼停靠點」的實際位置，視窗大小改變就重算 ---------- */
  function posIn(el, root) { let x = 0, y = 0, n = el; while (n && n !== root) { x += n.offsetLeft || 0; y += n.offsetTop || 0; n = n.offsetParent; } return { x: x, y: y }; }
  function berthPoints() {
    const world = $('sm-world'); if (!world || !world.offsetWidth || !world.offsetHeight) return null;
    const pts = [];
    for (let i = 0; i < ISLANDS.length; i++) {
      const b = $('berth-' + ISLANDS[i].key); if (!b) return null;
      const p = posIn(b, world); pts.push({ x: p.x + (b.offsetWidth || 0) / 2, y: p.y + (b.offsetHeight || 0) });
    }
    return pts;
  }
  function ctl(a, b) { const dx = (b.x - a.x) * 0.5; return [{ x: a.x + dx, y: a.y }, { x: b.x - dx, y: b.y }]; }
  function bez(a, b, t) {
    const c = ctl(a, b), u = 1 - t;
    return { x: u * u * u * a.x + 3 * u * u * t * c[0].x + 3 * u * t * t * c[1].x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c[0].y + 3 * u * t * t * c[1].y + t * t * t * b.y };
  }
  function drawRoute(pts) {
    const svg = $('sm-route'), world = $('sm-world'); if (!svg || !world || !pts) return;
    svg.setAttribute('viewBox', '0 0 ' + world.offsetWidth + ' ' + world.offsetHeight); svg.setAttribute('width', world.offsetWidth); svg.setAttribute('height', world.offsetHeight);
    let h = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], c = ctl(a, b);
      h += '<path class="sm-route__seg' + (S.infos[i] && S.infos[i].state === 'done' ? ' is-done' : '') + '" d="M' + a.x + ' ' + a.y + 'C' + c[0].x + ' ' + c[0].y + ' ' + c[1].x + ' ' + c[1].y + ' ' + b.x + ' ' + b.y + '"/>';
    }
    pts.forEach(function (p, i) { h += '<circle class="sm-route__lamp' + (S.infos[i] && S.infos[i].state === 'done' ? ' is-done' : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="7"/>'; });
    svg.innerHTML = h;
  }
  function boatSize() { const b = $('player-avatar'); return { w: (b && b.offsetWidth) || 70, h: (b && b.offsetHeight) || 78 }; }
  function tr(p, sz) { return 'translate(' + (p.x - sz.w / 2) + 'px,' + (p.y - sz.h) + 'px)'; }
  function place(p) { const b = $('player-avatar'); if (!b || !p) return; b.style.transform = tr(p, boatSize()); S.boatXY = { x: p.x, y: p.y }; }
  function currentXY() {
    if (S.sailing && typeof getComputedStyle === 'function') {
      try {
        const b = $('player-avatar'), m = /matrix\(([^)]+)\)/.exec(getComputedStyle(b).transform || ''); const sz = boatSize();
        if (m) { const v = m[1].split(',').map(parseFloat); return { x: v[4] + sz.w / 2, y: v[5] + sz.h }; }
      } catch (e) { /* 取不到就用最後記下的位置 */ }
    }
    return S.boatXY;
  }
  function layout() {
    const pts = berthPoints(); if (!pts) return null;
    drawRoute(pts);
    if (!S.sailing) place(pts[S.current]);
    return pts;
  }

  /* ---------- 4. 小船沿航線移動（回傳 Promise：到港 = true；中途被改成別的目的地 = false） ---------- */
  function dist(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }
  function sailTo(i) {
    i = clamp(i | 0, 0, ISLANDS.length - 1);
    if (S.sailing && S.sailing.to === i) return S.sailing.promise;
    const prev = S.current; S.current = i; paintNodes(); paintPanel();
    const pts = berthPoints(), boat = $('player-avatar');
    if (!pts || !boat) return Promise.resolve(true);
    const to = pts[i], from = currentXY() || pts[prev];
    if (S.sailing) { S.sailing.anim.cancel(); S.sailing = null; }
    if (reduced() || typeof boat.animate !== 'function' || dist(from, to) < 3) { place(to); return Promise.resolve(true); }
    /* 路徑：目前位置 → 經過途中每座島的停靠點（沿著畫出來的航線取樣）→ 目的地 */
    let near = 0; for (let k = 1; k < pts.length; k++) if (dist(from, pts[k]) < dist(from, pts[near])) near = k;
    const dir = (to.x >= from.x) ? 1 : -1, idxs = [];
    for (let k = near; (dir > 0 ? k <= i : k >= i); k += dir) if ((pts[k].x - from.x) * dir > 2) idxs.push(k);
    if (!idxs.length || idxs[idxs.length - 1] !== i) idxs.push(i);
    const path = [from]; let last = from;
    idxs.forEach(function (k) { const p = pts[k]; if (last === from) { path.push(p); } else { for (let t = 1; t <= 3; t++) path.push(bez(last, p, t / 4)); path.push(p); } last = p; });
    let total = 0; const cum = [0]; for (let k = 1; k < path.length; k++) { total += dist(path[k - 1], path[k]); cum.push(total); }
    if (!total) { place(to); return Promise.resolve(true); }
    const sz = boatSize();
    const frames = path.map(function (p, k) { return { transform: tr(p, sz), offset: k === path.length - 1 ? 1 : cum[k] / total }; });
    const anim = boat.animate(frames, { duration: clamp(total / 0.5, 520, 2200), easing: 'ease-in-out', fill: 'forwards' });
    const promise = anim.finished.then(function () {
      if (S.sailing && S.sailing.anim === anim) { place(to); anim.cancel(); S.sailing = null; }
      return true;
    }, function () { return false; });
    S.sailing = { to: i, anim: anim, promise: promise };
    return promise;
  }

  /* ---------- 5. 長海圖的捲動：把某座島放到畫面中央 ---------- */
  function scroller() { return $('map-canvas-container'); }
  function scrollable(sc) { sc = sc || scroller(); return !!(sc && sc.scrollWidth > sc.clientWidth + 2); }
  function centerTarget(i, sc) {
    const stop = $('stop-' + ISLANDS[i].key), world = $('sm-world'); if (!stop || !world) return null;
    const x = posIn(stop, world).x + stop.offsetWidth / 2 - sc.clientWidth / 2;
    return clamp(x, 0, Math.max(0, sc.scrollWidth - sc.clientWidth));
  }
  function centerOn(i, instant) {
    const sc = scroller(); if (!sc || !scrollable(sc)) return;
    const target = centerTarget(i, sc); if (target === null || Math.abs(sc.scrollLeft - target) < 2) return;
    S.scrollTarget = target;
    const smooth = !instant && !reduced();
    if (typeof sc.scrollTo === 'function') sc.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' }); else sc.scrollLeft = target;
  }
  function nearestToCenter(sc) {
    const world = $('sm-world'), mid = sc.scrollLeft + sc.clientWidth / 2; let best = 0, bd = Infinity;
    ISLANDS.forEach(function (it, i) { const s = $('stop-' + it.key); if (!s) return; const d = Math.abs(posIn(s, world).x + s.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  /* 捲到哪座島：先看「目前這座島自己的定位點」——平板的第一座靠左、最後一座靠右，頭尾的島定位點和隔壁島相同
     （第一、第二座都在 scrollLeft = 0），這時不能因為「畫面中央剛好是第二座」就把選擇改掉。 */
  function pick(sc) {
    const cur = centerTarget(S.current, sc);
    if (cur !== null && Math.abs(sc.scrollLeft - cur) <= 2) return S.current;
    return nearestToCenter(sc);
  }
  function onScroll() {
    const sc = scroller(); if (!sc) return;
    if (S.scrollTarget !== null) { if (Math.abs(sc.scrollLeft - S.scrollTarget) <= 2) S.scrollTarget = null; return; }
    const idx = pick(sc); if (idx !== S.current) select(idx, { scroll: false });
  }
  function touched() { const sea = $('sm-sea'); if (sea && sea.classList) sea.classList.add('is-touched'); }

  /* ---------- 6. 對外功能 ---------- */
  function select(i, o) {
    o = o || {}; i = clamp(i | 0, 0, ISLANDS.length - 1);
    const p = sailTo(i); if (o.scroll !== false) centerOn(i); return p;
  }
  /* 點島嶼：桌機＝直接前往；手機／平板上點到沒對準中央的島，只先把它滑到中央（避免滑動時誤入） */
  function go(name) {
    const i = idxOfName(name); if (i < 0) return Promise.resolve(false);
    const sc = scroller(), tg = sc ? centerTarget(i, sc) : null;
    const peek = S.downIdx !== null && S.downIdx !== i && scrollable() && !(tg !== null && Math.abs(sc.scrollLeft - tg) <= 2); S.downIdx = null;   /* 這座島已經在它的定位點上（例如平板第一、第二座都在 scrollLeft = 0）→ 直接前往 */
    if (peek) { select(i); return Promise.resolve(false); }
    const p = sailTo(i); centerOn(i); return p;
  }
  function enterCurrent() { S.downIdx = null; /* 按「進入島嶼」或鍵盤 Enter：一定是要進入，不要當成「先滑到中央」 */ triggerBoat(ISLANDS[S.current].name, $('node-' + ISLANDS[S.current].key)); }

  /* ---------- 7. 事件 ---------- */
  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let i = S.current; const t = e.target && e.target.getAttribute ? e.target.getAttribute('data-index') : null; if (t !== null && t !== undefined && t !== '') i = +t;
    if (e.key === 'ArrowRight') i += 1; else if (e.key === 'ArrowLeft') i -= 1; else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = ISLANDS.length - 1; else return;
    e.preventDefault(); i = clamp(i, 0, ISLANDS.length - 1);
    const n = $('node-' + ISLANDS[i].key); if (n && typeof n.focus === 'function') n.focus({ preventScroll: true });
    select(i);
  }
  function bindDrag(sc) {
    sc.addEventListener('pointerdown', function (e) {
      S.suppressClick = false; S.downIdx = S.current; S.scrollTarget = null; touched();
      if (e.pointerType === 'mouse' && e.button === 0 && scrollable(sc)) S.drag = { x: e.clientX, left: sc.scrollLeft, moved: false, id: e.pointerId };
    });
    sc.addEventListener('pointermove', function (e) {
      const d = S.drag; if (!d) return; const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 6) { d.moved = true; sc.classList.add('is-dragging'); try { sc.setPointerCapture(d.id); } catch (x) { /* 沒有也沒關係 */ } }
      if (d.moved) sc.scrollLeft = d.left - dx;
    });
    const end = function () {
      const d = S.drag; if (!d) return; S.drag = null;
      if (d.moved) { S.suppressClick = true; sc.classList.remove('is-dragging'); try { sc.releasePointerCapture(d.id); } catch (x) { /* 同上 */ } S.scrollTarget = null; select(pick(sc)); }
    };
    sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
    sc.addEventListener('click', function (e) { if (S.suppressClick) { S.suppressClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
  }
  function init() {
    if (S.inited) return; S.inited = true;
    ISLANDS.forEach(function (it, i) {
      const a = $('art-' + it.key); if (a) a.innerHTML = IslandArt.svg(it.art);
      const n = $('node-' + it.key); if (n && typeof n.addEventListener === 'function') n.addEventListener('focus', function () { select(i); });
    });
    const sc = scroller(); if (!sc || typeof sc.addEventListener !== 'function') return;
    sc.addEventListener('keydown', onKey);
    sc.addEventListener('scroll', function () { if (S.raf) return; S.raf = true; const f = function () { S.raf = false; onScroll(); }; if (typeof requestAnimationFrame === 'function') requestAnimationFrame(f); else f(); });
    sc.addEventListener('scrollend', function () { S.scrollTarget = null; });
    ['touchstart', 'wheel'].forEach(function (n) { sc.addEventListener(n, function () { S.scrollTarget = null; touched(); }, { passive: true }); });   /* 手指或滾輪接手 → 不再等程式捲動到位 */
    sc.addEventListener('keydown', touched, { passive: true });
    bindDrag(sc);
    const relayout = function () {
      const w = sc.clientWidth; const pts = layout(); if (!pts) return;
      if (w !== S.lastW) { S.lastW = w; centerOn(S.current, true); }
    };
    if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(relayout); ro.observe(sc); const wd = $('sm-world'); if (wd) ro.observe(wd); }
    else if (typeof window.addEventListener === 'function') window.addEventListener('resize', relayout);
    try { const mq = window.matchMedia('(prefers-reduced-motion: reduce)'); if (mq && mq.addEventListener) mq.addEventListener('change', relayout); } catch (e) { /* 舊瀏覽器 */ }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  }

  /* 進度或登入者改變後重畫（EffectEngine.updateMap 會呼叫） */
  function render() {
    if (!currentUser || !currentUser.progress) return;
    init();
    S.infos = ISLANDS.map(function (_, i) { return infoOf(i); });
    const newUser = (S.user !== currentUser);
    if (newUser) {
      S.user = currentUser; S.current = defaultIndex(); S.boatXY = null; S.scrollTarget = null; S.lhKey = []; S.boatKey = null; S.lastW = 0;
      if (S.sailing) { S.sailing.anim.cancel(); S.sailing = null; }
      const sea = $('sm-sea'); if (sea && sea.classList) sea.classList.remove('is-touched');
    }
    paintBoat(); paintNodes(); paintPanel();
    layout(); if (newUser) centerOn(S.current, true);
  }
  /* 地圖畫面剛顯示時（switchScreen 會呼叫）：畫面這時才有尺寸，才能量位置 */
  function onShow() {
    if (!currentUser) return; init(); layout(); centerOn(S.current, true);
  }

  return {
    ISLANDS: ISLANDS, state: S, render: render, onShow: onShow, select: select, go: go, enterCurrent: enterCurrent, paintBoat: paintBoat, layout: layout, reduced: reduced,
    sailTo: sailTo, centerOn: centerOn, scrollable: scrollable, nearestToCenter: function () { const sc = scroller(); return sc ? nearestToCenter(sc) : S.current; },
    info: function (i) { return S.infos[i]; }
  };
})();
