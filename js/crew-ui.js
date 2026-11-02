/* ==========================================================================
   《小小算術家：六島大冒險》船員登記所畫面控制（階段 4）
   - 六張船員卡＋中央碼頭預覽＋制服顏色／胸章選項＋「登船出發」
   - 全部用原生 radio（label 包起來），方向鍵、Tab、Space 本來就能用；Enter 補強：已選好時直接登船
   - 只有按下「登船出發」才會呼叫 selectAvatar(代碼)，由 auth.js 存進進度並更新後端（流程與舊版相同）
   - 不碰學生主鍵、不碰 Sheet 欄位、不使用 localStorage
   ========================================================================== */
const CrewRegistry = (function () {
  'use strict';
  const st = { c: 0, col: 0, b: 0, ready: false, busy: false };
  const $ = function (id) { return document.getElementById(id); };
  const CREW = AvatarKit.CREW, COLORS = AvatarKit.COLORS, BADGES = AvatarKit.BADGES;
  const DEFAULT_MSG = '先點一位小船員吧！';

  function cardHTML(ch) {
    return '<label class="crew-card" data-crew="' + ch.id + '">' +
      '<input type="radio" class="ds-sr-only" name="crew" value="' + ch.id + '">' +
      '<span class="crew-card__fig">' + AvatarKit.svg(AvatarKit.defaultsFor(ch.id), { label: false }) + '</span>' +
      '<span class="crew-card__text"><span class="crew-card__name">' + ch.name + '</span><span class="crew-card__look">' + ch.look + '</span></span>' +
      '<span class="crew-card__tick">' + UIKit.icon('check') + '</span></label>';
  }
  function colorChips() {
    return COLORS.map(function (c, i) {
      return '<label class="crew-chip"><input type="radio" class="ds-sr-only" name="crew-color" value="' + i + '"><span class="crew-chip__sw" style="--sw:' + c.main + '"></span><span class="crew-chip__txt">' + c.name + '</span></label>';
    }).join('');
  }
  function badgeChips() {
    return BADGES.map(function (b, i) {
      return '<label class="crew-chip"><input type="radio" class="ds-sr-only" name="crew-badge" value="' + i + '">' + AvatarKit.badgeSvg(i, 26) + '<span class="crew-chip__txt">' + b.name + '</span></label>';
    }).join('');
  }
  function dockHTML() {
    return '<div class="crew-dock"><div class="crew-dock__head">' +
      '<div class="crew-dock__scene" aria-hidden="true"><div class="crew-dock__fig" id="crew-fig"></div></div>' +
      '<p class="ds-plank crew-dock__name" id="crew-name">請選一位小船員</p>' +
      '<p class="ds-hint crew-dock__look" id="crew-look">點選任何一張船員卡，他就會登上碼頭。</p></div>' +
      optionsHTML() + '</div>';
  }
  function optionsHTML() {
    return '<div class="crew-options">' +
      '<fieldset class="crew-opt" id="crew-opt-color" disabled><legend>制服顏色</legend><div class="crew-opt__row">' + colorChips() + '</div></fieldset>' +
      '<fieldset class="crew-opt" id="crew-opt-badge" disabled><legend>胸章</legend><div class="crew-opt__row">' + badgeChips() + '</div></fieldset></div>';
  }

  function setChecked(name, value) {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (r) { r.checked = (String(r.value) === String(value)); });
  }
  function say(msg) { const m = $('crew-msg'); if (m) m.textContent = msg; }

  function paint() {
    const fig = $('crew-fig'), name = $('crew-name'), look = $('crew-look'), who = $('crew-who'), go = $('btn-boarding');
    const has = st.c > 0;
    if (fig) fig.innerHTML = has ? AvatarKit.svg({ c: st.c, col: st.col, b: st.b }, { label: false }) : '<span class="crew-dock__empty">?</span>';
    if (fig) fig.classList.toggle('is-empty', !has);
    if (name) name.textContent = has ? CREW[st.c - 1].name : '請選一位小船員';
    if (look) look.textContent = has ? (COLORS[st.col].name + '色制服、' + BADGES[st.b].name + '胸章。' + CREW[st.c - 1].look) : '點選任何一張船員卡，他就會登上碼頭。';
    if (who) who.innerHTML = has ? AvatarKit.bustHTML({ c: st.c, col: st.col, b: st.b }, 48) + '<span class="crew-who__name">' + CREW[st.c - 1].name + '</span>' : '<span class="crew-who__name">尚未選擇</span>';
    if (go) { go.setAttribute('aria-disabled', has ? 'false' : 'true'); go.classList.toggle('is-disabled', !has); }
    const f1 = $('crew-opt-color'), f2 = $('crew-opt-badge'); if (f1) f1.disabled = !has; if (f2) f2.disabled = !has;
    Array.prototype.forEach.call(document.querySelectorAll('.crew-card'), function (c) { c.classList.toggle('is-picked', +c.getAttribute('data-crew') === st.c); });
  }
  function pick(id) {
    st.c = id; st.col = CREW[id - 1].color; st.b = 0;
    setChecked('crew', id); setChecked('crew-color', st.col); setChecked('crew-badge', st.b);
    paint(); say('已選 ' + CREW[id - 1].name + '！可調整顏色和胸章，再登船。');
    const fig = $('crew-fig'); if (fig && fig.classList) { fig.classList.remove('is-hop'); void fig.offsetWidth; fig.classList.add('is-hop'); }
  }

  function confirm() {
    if (st.busy) return;
    if (!st.c) {
      say('請先點一位小船員，再按「登船出發」。');
      const first = document.querySelector('input[name="crew"]'); if (first && first.focus) first.focus();
      return;
    }
    st.busy = true;
    const code = AvatarKit.encode({ c: st.c, col: st.col, b: st.b });
    try { selectAvatar(code); } finally { st.busy = false; }
  }

  function onKey(e) {
    if (e.key !== 'Enter') return;
    const t = e.target; if (!t || t.tagName !== 'INPUT') return;
    e.preventDefault();
    if (t.name === 'crew' && +t.value !== st.c) { pick(+t.value); return; }
    confirm();
  }

  function init() {
    if (st.ready) return; st.ready = true;
    const stage = $('crew-stage');
    if (stage) {
      stage.innerHTML = CREW.map(cardHTML).join('') + dockHTML();
      stage.addEventListener('change', function (e) {
        const t = e.target; if (!t) return;
        if (t.name === 'crew') pick(+t.value);
        else if (t.name === 'crew-color') { st.col = +t.value; paint(); say(COLORS[st.col].name + '色制服。'); }
        else if (t.name === 'crew-badge') { st.b = +t.value; paint(); say(BADGES[st.b].name + '胸章。'); }
      });
      stage.addEventListener('keydown', onKey);
    }
    const go = $('btn-boarding'); if (go) go.addEventListener('click', confirm);
    const row = $('en-crewrow');
    if (row) row.innerHTML = CREW.map(function (ch) { return '<span class="en-crewrow__one">' + AvatarKit.svg(AvatarKit.defaultsFor(ch.id), { label: false }) + '</span>'; }).join('');
    UIKit.hydrate(document);
    paint();
  }
  /** 進入船員登記所前呼叫：回到「還沒選」的狀態 */
  function open() {
    init();
    st.c = 0; st.col = 0; st.b = 0; st.busy = false;
    setChecked('crew', -1); setChecked('crew-color', -1); setChecked('crew-badge', -1);
    paint(); say(DEFAULT_MSG);
    const go = $('btn-boarding'); if (go && go.classList) go.classList.remove('is-loading');
  }
  /** 切到畫面之後呼叫：把焦點放在標題，讀屏軟體會先唸「船員登記所」，鍵盤使用者按 Tab 就到第一張卡 */
  function focusStart() { const t = $('crew-title'); if (t && t.focus) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }

  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', init);
  return { init: init, open: open, focusStart: focusStart, pick: pick, confirm: confirm, state: st };
})();
