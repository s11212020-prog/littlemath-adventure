/* ==========================================================================
   階段 8.1：我的稱號航線（完整稱號面板）
   - 只「讀」：稱號與門檻來自 ProgressSystem.TITLE_LEVELS（js/map.js，唯一規則來源），總星數用 ProgressSystem.calcTotal(currentUser.progress)。
   - 開啟、關閉都不會寫入任何資料：不呼叫 API、不改 currentUser.progress／total_stars、不新增紀錄。
   - 焦點／Esc／Tab 迴圈／回到啟動按鈕：沿用 UIKit.openDialog；點遮罩也能關閉。
   ========================================================================== */
const TitleRoute = (function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const ic = function (name, size, cls) { try { return UIKit.icon(name, { size: size, className: cls || '' }); } catch (e) { return ''; } };
  const BADGES = ['bottle', 'map', 'star', 'crew', 'hint', 'lighthouse', 'crown'];   /* 七個稱號各一個原創徽章圖示 */
  const BOAT = '<svg class="tr-boat" viewBox="0 0 48 48" focusable="false" aria-hidden="true"><path d="M24 6v25M24 8 10 30h14z" fill="#FFF9E8" stroke="#17324D" stroke-width="2.4" stroke-linejoin="round"/><path d="M27 12v19h12z" fill="#FFD166" stroke="#17324D" stroke-width="2.4" stroke-linejoin="round"/><path d="M6 33h36l-6 9H12z" fill="#FF7A59" stroke="#17324D" stroke-width="2.4" stroke-linejoin="round"/></svg>';

  function totalNow() { return ProgressSystem.calcTotal((currentUser && currentUser.progress) || {}); }

  /* 海圖頂端的按鈕：讓讀屏軟體念出目前位置與下一級（文字由海圖更新時一併帶入） */
  function syncButton(ts, tInfo) {
    const b = $('btn-title-route'); if (!b) return;
    const info = ProgressSystem.titleInfo(ts);
    b.setAttribute('aria-label', '查看稱號航線。目前稱號：' + info.current.title + '，' + info.total + ' 顆星，共 ' + info.max + ' 顆。' + (info.isMax ? '已達最高榮譽。' : '再 ' + info.remain + ' 顆星升級。'));
  }

  function nodeHTML(n, info) {
    const i = info.nodes.indexOf(n); const cls = 'is-' + n.status;
    const stateTxt = n.status === 'done' ? '已達成' : (n.status === 'current' ? '目前稱號' : (n.status === 'next' ? '下一個目標' : '尚未達成'));
    const stateIcon = n.status === 'done' ? ic('check', 22) : (n.status === 'current' ? ic('compass', 22) : (n.status === 'next' ? ic('next', 22) : ic('lock', 22)));
    const goal = n.status === 'next' ? '<span class="tr-node__goal"><b>還差 ' + info.remain + ' 顆星</b><span>' + n.min + ' 星達成</span></span>' : '';
    return '<li class="tr-node ' + cls + '"' + (n.status === 'current' ? ' aria-current="step"' : '') + ' data-min="' + n.min + '" data-status="' + n.status + '">' +
      '<span class="tr-node__badge" aria-hidden="true">' + ic(BADGES[i] || 'star', 40) + (n.status === 'done' ? '<span class="tr-node__tick">' + ic('check', 18) + '</span>' : '') + '</span>' +
      (n.status === 'current' ? '<span class="tr-node__boat" aria-hidden="true">' + BOAT + '</span>' : '') +
      '<span class="tr-node__min">' + n.min + ' 星</span><span class="tr-node__name">' + esc(n.title) + '</span>' +
      '<span class="tr-node__state">' + stateIcon + '<span>' + stateTxt + '</span></span>' + goal + '</li>';
  }

  function render() {
    const total = totalNow(); const info = ProgressSystem.titleInfo(total); const cu = currentUser || {};
    const set = function (id, v) { const e = $(id); if (e) e.textContent = v; };
    set('tr-nick', cu.nickname || '船員'); set('tr-current', info.current.title);
    set('tr-total', info.total + '／' + info.max);
    const nx = $('tr-next'); if (nx) nx.textContent = info.isMax ? '已達最高榮譽！' : ('下一個目標：' + info.next.title + '，還差 ' + info.remain + ' 顆星（' + info.next.min + ' 星達成）');
    const av = $('tr-avatar'); if (av) { try { av.innerHTML = (typeof RewardLook !== 'undefined' ? RewardLook.ownBust(cu.progress && cu.progress.avatar, 64) : AvatarKit.bustHTML(cu.progress && cu.progress.avatar, 64)); } catch (e) { av.innerHTML = ''; } }
    const pct = Math.round(info.total / info.max * 1000) / 10;
    const fill = $('tr-bar-fill'); if (fill) fill.style.width = pct + '%';
    const boat = $('tr-bar-boat'); if (boat) { boat.style.left = pct + '%'; boat.innerHTML = BOAT; }
    const bar = $('tr-bar'); if (bar) { bar.setAttribute('aria-valuenow', String(info.total)); bar.setAttribute('aria-valuetext', info.total + ' 顆星，共 ' + info.max + ' 顆星'); }
    const ticks = $('tr-bar-ticks'); if (ticks) ticks.innerHTML = ProgressSystem.TITLE_LEVELS.map(function (L, k) { return '<span class="tr-tick' + (info.total >= L.min ? ' is-reached' : '') + '" style="left:' + (L.min / info.max * 100) + '%">' + L.min + '</span>'; }).join('');
    const route = $('tr-route'); if (route) route.innerHTML = info.nodes.map(function (n) { return nodeHTML(n, info); }).join('');
    const mx = $('tr-max'); if (mx) mx.hidden = !info.isMax;
    return info;
  }

  function isOpen() { const o = $('title-route'); return !!(o && o.__open); }
  /* 面板開著時，後面的海圖不可操作（inert；舊版 Safari 沒有 inert 時，至少讓讀屏軟體略過）。
     不論用 Esc、關閉鈕、點遮罩關閉，只要面板變成 hidden 就自動解除，並把焦點還給觸發的按鈕。 */
  let trig = null, watcher = null;
  function lockBackground(on) {
    const s = $('screen-map'); if (!s) return;
    if (on) { s.setAttribute('inert', ''); s.setAttribute('aria-hidden', 'true'); } else { s.removeAttribute('inert'); s.removeAttribute('aria-hidden'); }
  }
  function open(trigger) {
    if (!currentUser) return false;
    const o = $('title-route'); if (!o || o.__open) return false;
    render(); trig = trigger || document.activeElement;
    try { UIKit.openDialog(o, trig); } catch (e) { return false; }
    lockBackground(true);
    if (!watcher && typeof MutationObserver !== 'undefined') {
      watcher = new MutationObserver(function () { if (o.hidden) { lockBackground(false); if (trig && trig.focus && document.contains(trig)) trig.focus({ preventScroll: true }); } });
      watcher.observe(o, { attributes: true, attributeFilter: ['hidden'] });
    }
    return true;
  }
  function close() { lockBackground(false); try { UIKit.closeDialog($('title-route')); } catch (e) { /* 測試環境 */ } }

  function bind() {
    const b = $('btn-title-route'); if (b) b.addEventListener('click', function () { open(b); });
    const o = $('title-route');
    if (o) {       /* 點遮罩（面板外面）關閉；UIKit 也會處理，這裡保留觸控的 click 版本 */
      o.addEventListener('click', function (e) { if (e.target === o) close(); });
    }
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind(); }

  return { render: render, open: open, close: close, isOpen: isOpen, syncButton: syncButton, BADGES: BADGES };
})();
