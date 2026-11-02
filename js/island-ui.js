/* ==========================================================================
   《小小算術家：六島大冒險》階段 6／6.1：島內畫面的「顯示層」
   - 只負責「畫出來」：港口（區域選單）、島內頂部列、題目進度、回饋泡泡、結果卡、離開確認。
   - 不改答題流程、題庫、提示、自適應、存檔：那些仍在 questions.js / twostep.js / answer-flow.js / quiz-ui.js。
   - 回饋文字（res.msg）和上傳到 Google Sheet 的 error_diagnosis 完全不變；
     畫面上只是把文字開頭的 emoji 換成原創 SVG 圖示（FB.set），文字內容一字不改。
   - 所有函式都小心處理「測試環境沒有真的 DOM」的情況（不會因為缺少 querySelector 等而丟錯）。
   ========================================================================== */
const IslandUI = (function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const ic = function (name, size, cls) { try { return UIKit.icon(name, { size: size || 24, className: cls || '' }); } catch (e) { return ''; } };

  const ZONES = [
    { key: 'LEARNING', zh: '概念學習區', short: '學習', n: 1, sub: '先看動畫，再做 3 題' },
    { key: 'PRACTICE', zh: '互動練習區', short: '練習', n: 2, sub: '5 題，邊做邊學' },
    { key: 'MASTERY',  zh: '掌握確認區', short: '掌握', n: 3, sub: '10 題，證明你學會了' }
  ];
  const ART_KEY = { '加法島': 'add', '減法島': 'sub', '乘法島': 'mul', '除法島': 'div', '應用題島': 'wp', '四則運算島': 'mix' };
  const THEME = { '加法島': 'theme-addition', '減法島': 'theme-subtraction', '乘法島': 'theme-multiplication', '除法島': 'theme-division', '應用題島': 'theme-application', '四則運算島': 'theme-order' };
  const zoneName = function (z) { for (let i = 0; i < ZONES.length; i++) if (ZONES[i].key === z) return ZONES[i].zh; return z; };
  const bestOf = function (arr) { return ProgressSystem.getBestStar(arr); };

  function reduced() {
    try { const de = document.documentElement; if (de && de.classList && de.classList.contains('reduce-motion')) return true; } catch (e) { /* 測試環境 */ }
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  /* ---------- 1. 回饋泡泡：文字不變，開頭的 emoji 換成圖示 ---------- */
  const EMOJI_ICON = { '✅': 'check', '🎉': 'star', '⚠️': 'warn', '⚠': 'warn', '👀': 'eye', '💡': 'hint', '🪜': 'steps', '👍': 'spark', '🤔': 'think', '🧭': 'compass', '🚀': 'next', '🏮': 'lighthouse', '🌟': 'star', '✨': 'spark', '🤖': '' };
  const LEAD = /^(✅|🎉|⚠️|⚠|👀|💡|🪜|👍|🤔|🧭|🚀|🏮|🌟|✨|🤖)\s*/;
  function lineHTML(line) {
    const m = LEAD.exec(line); let ico = '', rest = line;
    if (m) { const name = EMOJI_ICON[m[1]]; rest = line.slice(m[0].length); if (name) ico = '<span class="fb-ic" aria-hidden="true">' + ic(name, 26) + '</span>'; }
    return '<span class="fb-line">' + ico + '<span class="fb-tx">' + esc(rest) + '</span></span>';
  }
  const FB = {
    /* 設定回饋：kind = info | success | error；opt.hint = 第幾級提示（1～3）時，顯示「提示 n／3」 */
    set: function (id, msg, kind, opt) {
      const el = $(id); if (!el) return;
      el.className = 'feedback-bubble ' + (kind || 'info');
      el.innerText = msg;                                          // 純文字版本（讀屏、測試都讀這個）
      try {
        let h = String(msg).split('\n').map(lineHTML).join('');
        const lvl = opt && opt.hint;
        if (lvl) h = '<span class="fb-hint" aria-label="提示第 ' + lvl + ' 級，共 3 級">' + ic('hint', 22) + '<span>提示 ' + lvl + '／3</span><span class="fb-hint__dots" aria-hidden="true">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= lvl ? 'is-on' : '') + '"></i>'; }).join('') + '</span></span>' + h;
        el.innerHTML = h;
      } catch (e) { /* 測試環境：保留純文字 */ }
      if (kind === 'error' && !reduced()) { try { el.classList.remove('fb-pop'); void el.offsetWidth; el.classList.add('fb-pop'); } catch (e) { /* 同上 */ } }
    }
  };

  /* ---------- 2. 題目進度（第幾題／共幾題）：已完成＝勾勾、目前＝放大加粗框、之後＝空心 ---------- */
  function progressHTML(s) {
    let h = '';
    for (let i = 1; i <= s.totalQ; i++) {
      const st = i < s.qIndex ? 'done' : (i === s.qIndex ? 'now' : 'next');
      h += '<li class="ig-node is-' + st + '"' + (st === 'now' ? ' aria-current="step"' : '') + '><span class="ig-node__mark">' + (st === 'done' ? ic('check', 18) : i) + '</span><span class="ds-sr-only">第 ' + i + ' 題' + (st === 'done' ? '，已完成' : (st === 'now' ? '，目前這一題' : '，還沒做')) + '</span></li>';
    }
    return h;
  }

  /* ---------- 3. 三個區域的小燈塔（學習 → 練習 → 掌握）：亮燈＝這一區已過關 ---------- */
  function zoneBest(island, zoneKey) {
    const prog = currentUser && currentUser.progress ? currentUser.progress[island] : null;
    return prog ? bestOf(prog[zoneKey]) : 0;
  }
  function lampsHTML(island, curZone) {
    return ZONES.map(function (z) {
      const lit = zoneBest(island, z.key) >= 1, cur = z.key === curZone;
      return '<li class="ig-lamp' + (lit ? ' is-lit' : '') + (cur ? ' is-current' : '') + '"' + (cur ? ' aria-current="step"' : '') + '><span class="ig-lamp__bulb" aria-hidden="true">' + ic(lit ? 'lighthouse' : 'compass', 24) + '</span><span class="ig-lamp__txt">' + z.short + '<span class="ds-sr-only">區' + (lit ? '，已過關' : '，還沒過關') + (cur ? '，目前在這裡' : '') + '</span></span></li>';
    }).join('');
  }

  /* ---------- 4. 島內頂部列（進入島嶼、換區域、完成一區時重畫） ---------- */
  function crewHTML(px) { try { const av = currentUser && currentUser.progress ? currentUser.progress.avatar : null; return (typeof RewardLook !== 'undefined' ? RewardLook.ownBust(av, px || 64) : AvatarKit.bustHTML(av, px || 64)); } catch (e) { return ''; } }
  function paintHUD() {
    const s = GameFlowController.state; const isl = s.island;
    const nm = $('ui-island-name'); if (nm) nm.innerText = isl;
    const chip = $('ui-zone-chip'); if (chip) chip.innerHTML = ic(s.zone === 'LEARNING' ? 'book' : (s.zone === 'PRACTICE' ? 'compass' : 'crown'), 22) + '<span>' + esc(zoneName(s.zone)) + '</span>';
    try { const art = $('ui-island-art'); if (art) art.innerHTML = IslandArt.svg(ART_KEY[isl] || 'add'); } catch (e) { /* 測試環境 */ }
    const lamps = $('ui-zone-lamps'); if (lamps) lamps.innerHTML = lampsHTML(isl, s.zone);
    try { document.querySelectorAll('.ig-crew').forEach(function (el) { el.innerHTML = crewHTML(64); }); } catch (e) { /* 測試環境 */ }
  }
  /* 階段 6.1：島嶼代碼（add／sub／mul／div／wp／mix）寫在 data-island，CSS 變數與場景都跟著它切換 */
  function setTheme(island) {
    const sg = $('screen-game'); if (!sg) return;
    const code = ART_KEY[island] || 'add';
    sg.className = 'screen ig-screen ' + (THEME[island] || 'theme-addition');
    try { sg.dataset.island = code; } catch (e) { /* 測試環境 */ }
    try { if (typeof SceneArt !== 'undefined') SceneArt.render(code); } catch (e) { /* 測試環境：沒有場景層也不影響答題 */ }
  }

  /* ---------- 5. 港口：選擇區域（原 showIslandModal 的畫面；解鎖規則完全沿用） ---------- */
  function zoneState(i, prog) {
    const best = bestOf(prog[ZONES[i].key]);
    const prevBest = i === 0 ? 3 : bestOf(prog[ZONES[i - 1].key]);
    return { best: best, done: best >= 1, open: i === 0 || prevBest >= 1 };
  }
  function recordText(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '尚未挑戰';
    const best = bestOf(arr);
    const hist = arr.map(function (r) { const st = typeof r === 'object' ? r.stars : 0; return st > 0 ? st + '星' : '完成'; }).join('、');
    return best > 0 ? '歷次：' + hist : '練習 ' + arr.length + ' 次';
  }
  function portHTML(island) {
    const prog = (currentUser.progress[island]) || { LEARNING: [], PRACTICE: [], MASTERY: [] };
    const lhs = LighthouseSystem.deriveState(prog);
    const sum = '<div class="zp-sum"><span class="ds-chip ds-chip--warn">' + ic('lighthouse', 22) + '燈塔 ' + lhs.litCount + '／3</span><span class="ds-chip ds-chip--warn">' + ic('star', 22) + '星星 ' + lhs.earnedStars + '／9</span>' + (lhs.islandIlluminated ? '<span class="ds-chip ds-chip--success">' + ic('spark', 22) + '全島點亮</span>' : '') + '</div>' +
      '<p class="zp-tip">一區一區往前走：過關（至少 1 顆星）才會打開下一區。</p>';
    const cards = ZONES.map(function (z, i) {
      const st = zoneState(i, prog);
      const stateChip = st.done ? '<span class="ds-chip ds-chip--success">' + ic('check', 20) + '已過關</span>' : (st.open ? '<span class="ds-chip ds-chip--info">' + ic('next', 20) + '可以挑戰</span>' : '<span class="ds-chip ds-chip--warn">' + ic('lock', 20) + '需完成' + ZONES[i - 1].short + '區</span>');
      const stars = UIKit.starsHTML(st.best, 3, { label: z.zh + '最佳 ' + st.best + ' 顆星' });
      const body = '<span class="zp-zone__no" aria-hidden="true">' + (st.done ? ic('check', 26) : (st.open ? z.n : ic('lock', 24))) + '</span>' +
        '<span class="zp-zone__main"><span class="zp-zone__name">' + z.zh + '</span><span class="zp-zone__sub">' + z.sub + '</span><span class="zp-zone__rec">' + recordText(prog[z.key]) + '</span></span>' +
        '<span class="zp-zone__side">' + stars + stateChip + '</span>';
      return '<button type="button" class="zp-zone is-' + (st.done ? 'done' : (st.open ? 'open' : 'locked')) + '" data-zone="' + z.key + '"' + (st.open ? '' : ' disabled') + ' onclick="enterIslandFromModal(\'' + z.key + '\')">' + body + '</button>';
    }).join('');
    const cancel = '<button type="button" class="ds-btn ds-btn--ghost zp-cancel" onclick="closePort()">' + ic('back', 26) + '<span>取消</span></button>';
    return { sum: sum, actions: cards + cancel };
  }
  function openPort(island) {
    const t = $('modal-title'); if (t) t.innerText = island + ' 挑戰紀錄';
    const h = portHTML(island);
    $('modal-records').innerHTML = h.sum; $('modal-actions').innerHTML = h.actions;
    try { const art = $('zp-art'); if (art) art.innerHTML = IslandArt.svg(ART_KEY[island] || 'add'); } catch (e) { /* 測試環境 */ }
    const ov = $('modal-report'); ov.style.display = 'flex';
    try { ov.dataset.island = ART_KEY[island] || 'add'; } catch (e) { /* 測試環境 */ }
    try {                                   // 焦點：放到第一個可以按的區域；Esc 關閉；Tab 不會跑到後面的海圖
      ov.__trigger = document.activeElement; const first = ov.querySelector('.zp-zone:not([disabled])') || ov.querySelector('button');
      if (first && first.focus) setTimeout(function () { first.focus({ preventScroll: true }); }, 0);
      if (!ov.__key) {
        ov.__key = function (e) {
          if (ov.style.display !== 'flex') return;
          if (e.key === 'Escape') { e.preventDefault(); closePort(); return; }
          if (e.key !== 'Tab') return;
          const f = Array.prototype.filter.call(ov.querySelectorAll('button:not([disabled])'), function (n) { return n.offsetParent !== null; }); if (!f.length) return;
          const a = f[0], z = f[f.length - 1];
          if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
        };
        document.addEventListener('keydown', ov.__key, true);
      }
    } catch (e) { /* 測試環境 */ }
  }
  function closePort(noFocus) {
    const ov = $('modal-report'); if (!ov) return; ov.style.display = 'none';
    try { const t = ov.__trigger; if (!noFocus && t && t.focus && document.contains(t)) t.focus({ preventScroll: true }); } catch (e) { /* 測試環境 */ }
  }

  /* ---------- 6. 結果卡：完成一區時，用圖示把「這一區的成果」整理給學生看 ---------- */
  function lastRecord(island, zone) {
    const prog = currentUser && currentUser.progress ? currentUser.progress[island] : null; const arr = prog && prog[zone];
    return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
  }
  function cheer(stars) { return stars >= 3 ? '太厲害了！這一區你幾乎都一次就答對！' : (stars === 2 ? '很棒！再練習一下，下次可以拿到 3 顆星！' : '完成了！多練習幾次，星星會越來越多。'); }
  function showResult() {
    const box = $('island-result'); if (!box) return;
    const s = GameFlowController.state, rec = lastRecord(s.island, s.zone) || { stars: s.stars, accuracy: 0 };
    const lhs = LighthouseSystem.stateOf(s.island); const pend = LighthouseSystem.pending;
    const newLamp = !!(pend && pend.island === s.island);
    const lamps = ZONES.map(function (z) {
      const lit = zoneBest(s.island, z.key) >= 1; const isNow = z.key === s.zone && newLamp;
      return '<li class="ig-rl' + (lit ? ' is-lit' : '') + (isNow ? ' is-new' : '') + '"><span class="ig-rl__bulb" aria-hidden="true">' + ic(lit ? 'lighthouse' : 'compass', 34) + '</span><span class="ig-rl__txt">' + z.short + (isNow ? '<b class="ig-rl__new">新！</b>' : '') + '</span><span class="ds-sr-only">' + (lit ? '已過關' : '還沒過關') + '</span></li>';
    }).join('');
    const stars = '<div class="ig-result__stars" role="img" aria-label="這一區獲得 ' + rec.stars + ' 顆星，共 3 顆">' + [1, 2, 3].map(function (i) { return '<span class="ig-rs ' + (i <= rec.stars ? 'is-on' : 'is-off') + '" style="--i:' + i + '">' + ic(i <= rec.stars ? 'star' : 'star-empty', 64) + '</span>'; }).join('') + '</div>';
    box.innerHTML = '<div class="ig-result__card">' +
      '<div class="ig-result__head"><span class="ig-crew ig-crew--lg" aria-hidden="true">' + crewHTML(84) + '</span><div><h3 class="ig-result__title" id="ig-result-title" tabindex="-1">' + esc(zoneName(s.zone)) + '完成！</h3><p class="ig-result__msg">' + esc(cheer(rec.stars)) + '</p></div></div>' +
      stars +
      '<ul class="ig-result__facts"><li class="ds-chip ds-chip--success">' + ic('check', 22) + '答對率 ' + esc(rec.accuracy) + '%</li><li class="ds-chip ds-chip--warn">' + ic('star', 22) + '獲得 ' + rec.stars + ' 顆星</li><li class="ds-chip ds-chip--info">' + ic('lighthouse', 22) + '燈塔 ' + lhs.litCount + '／3</li></ul>' +
      '<ol class="ig-result__lamps" aria-label="三個區域的燈塔">' + lamps + '</ol>' +
      (newLamp ? '<p class="ig-result__lh">' + ic('spark', 24) + '這一區過關了，回到海圖就會看到燈塔亮起來！</p>' : '') +
      '</div>';
    box.classList.add('is-visible');
    const sg = $('screen-game'); if (sg && sg.classList) sg.classList.add('ig-finished');
    try { const tt = $('ig-result-title'); if (tt && tt.focus) tt.focus({ preventScroll: false }); } catch (e) { /* 測試環境 */ }
  }
  function hideResult() {
    const box = $('island-result'); if (box) { box.classList.remove('is-visible'); box.innerHTML = ''; }
    const sg = $('screen-game'); if (sg && sg.classList) sg.classList.remove('ig-finished');
  }

  /* ---------- 7. 離開島嶼：答到一半才會問；動畫中、剛進來、已完成都直接回海圖 ---------- */
  function needsConfirm() {
    const s = GameFlowController.state; const st = QF.state;
    if (st === 'ANIMATION' || st === 'IDLE' || st === 'FINISHED') return false;
    if (!s.currentQ) return false;
    return s.qIndex > 1 || s.attempts > 0 || (s.wrongs || 0) > 0;
  }
  function leave() {
    if (!needsConfirm()) { backToMap(); return; }
    try { UIKit.openDialog($('modal-leave'), $('btn-leave')); } catch (e) { backToMap(); }
  }
  function leaveCancel() { try { UIKit.closeDialog($('modal-leave')); } catch (e) { /* 測試環境 */ } }
  function leaveConfirm() { try { UIKit.closeDialog($('modal-leave')); } catch (e) { /* 測試環境 */ } backToMap(); }

  /* 載入時把靜態畫面裡的圖示佔位換成真圖示 */
  try { if (typeof document !== 'undefined' && document.querySelectorAll) UIKit.hydrate(document); } catch (e) { /* 測試環境 */ }

  return {
    version: '1.1.0', ZONES: ZONES, FB: FB, zoneName: zoneName, progressHTML: progressHTML, lampsHTML: lampsHTML, paintHUD: paintHUD, setTheme: setTheme,
    portHTML: portHTML, openPort: openPort, closePort: closePort, showResult: showResult, hideResult: hideResult, needsConfirm: needsConfirm,
    leave: leave, leaveCancel: leaveCancel, leaveConfirm: leaveConfirm, reduced: reduced
  };
})();
/* 其他檔案（HTML onclick）使用的簡短名稱 */
const FB = IslandUI.FB;
function leaveIsland() { IslandUI.leave(); }
function closePort() { IslandUI.closePort(); }
