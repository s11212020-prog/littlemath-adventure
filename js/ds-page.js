/* 設計系統測試頁的組裝腳本（只給 design-system.html 用） */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const root = document.documentElement;
  const cssVar = n => getComputedStyle(root).getPropertyValue(n).trim();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 對比度（WCAG 2.x） ---------- */
  function lum(hex) { const h = hex.replace('#', ''); const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function ratio(a, b) { let x = lum(a), y = lum(b); if (x < y) { const t = x; x = y; y = t; } return (x + 0.05) / (y + 0.05); }
  const V = n => cssVar(n).toUpperCase();

  /* ---------- 1. 色彩 ---------- */
  const BASE = [['深海主色', '--ocean-deep'], ['亮海洋色', '--ocean-bright'], ['淺水色', '--ocean-pale'], ['珊瑚橘', '--coral'], ['陽光黃', '--sun-gold'], ['薄荷綠', '--mint'], ['故事紫', '--story-violet'], ['墨水藍', '--ink'], ['乳白表面', '--surface'], ['錯誤紅', '--danger'],
    ['紫（按鈕用）', '--story-violet-strong'], ['紅（按鈕用）', '--danger-strong'], ['綠（文字用）', '--mint-strong'], ['黃（文字用）', '--gold-strong'], ['次要文字', '--ink-soft'], ['邊框線', '--line']];
  $('#sw-base').innerHTML = BASE.map(([n, v]) => `<div class="sw"><div class="sw__c" style="background:var(${v})"></div><div class="sw__m"><b>${n}</b><br><code>${v}</code><br><code>${V(v)}</code></div></div>`).join('');
  const ISL = [['加法島', 'add'], ['減法島', 'sub'], ['乘法島', 'mul'], ['除法島', 'div'], ['應用題島', 'wp'], ['四則運算島', 'mix']];
  $('#sw-island').innerHTML = ISL.map(([n, k]) => `<div class="sw"><div class="sw__c" style="background:linear-gradient(90deg,var(--island-${k}) 50%,var(--island-${k}-2) 50%)"></div><div class="sw__m"><b>${n}</b><br><code>--island-${k} / -2</code></div></div>`).join('');

  const PAIRS = [
    ['正文', '--ink', '--surface', 4.5], ['次要文字', '--ink-soft', '--surface', 4.5], ['珊瑚按鈕', '--ink', '--coral', 4.5], ['亮海洋按鈕', '--ink', '--ocean-bright', 4.5],
    ['深海按鈕', '--white', '--ocean-deep', 4.5], ['薄荷按鈕', '--ink', '--mint', 4.5], ['陽光按鈕', '--ink', '--sun-gold', 4.5], ['紫色按鈕', '--white', '--story-violet-strong', 4.5],
    ['錯誤按鈕', '--white', '--danger-strong', 4.5], ['停用按鈕', '--disabled-ink', '--disabled-face', 4.5], ['成功提示', '--state-success-ink', '--state-success-bg', 4.5],
    ['資訊提示', '--state-info-ink', '--state-info-bg', 4.5], ['警告提示', '--state-warn-ink', '--state-warn-bg', 4.5], ['錯誤提示', '--state-danger-ink', '--state-danger-bg', 4.5],
    ['頁首（深海底）', '--white', '--ocean-deep', 4.5], ['元件邊框（非文字 ≥3）', '--line', '--surface', 3.0]
  ];
  const rows = PAIRS.map(([n, fg, bg, need]) => { const r = ratio(V(fg), V(bg)); return { n, fg, bg, need, r, ok: r >= need }; });
  $('#t-contrast tbody').innerHTML = rows.map(x => `<tr><td>${x.n}</td><td><code>${x.fg}</code></td><td><code>${x.bg}</code></td><td>${x.r.toFixed(2)} : 1</td><td class="${x.ok ? 'pass' : 'fail'}">${x.ok ? '通過' : '未通過'}（≥ ${x.need}）</td></tr>`).join('');

  /* ---------- 2. 字體 ---------- */
  const TYPES = [['入口標題', 'ds-title-stroke', '小小算術家', '≥ 30px 流動', 28], ['H1', 'ds-text-h1', '海上六島大冒險', '手機不擠成多行', 24], ['H2', 'ds-text-h2', '加法島挑戰紀錄', '', 20], ['H3', 'ds-text-h3', '互動練習區', '', 18],
    ['題目', 'ds-text-question', '18 ＋ 6 ＝ ？', '22–32px', 22], ['正文', 'ds-text-body', '他將陪你一起探索六座島嶼。', '桌機 ≥18、手機 ≥17', 17], ['說明', 'ds-text-caption', '再 6 顆星升級', '只用於次要說明', 14]];
  const tb = $('#t-type tbody');
  TYPES.forEach(([n, c, sample, req, min]) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${n}</td><td><span class="${c}" style="display:inline-block">${sample}</span></td><td class="px">—</td><td>${req}</td>`; tb.appendChild(tr); tr.__min = min; tr.__el = tr.querySelector('span'); });
  function refreshType() { tb.querySelectorAll('tr').forEach(tr => { const px = parseFloat(getComputedStyle(tr.__el).fontSize); tr.querySelector('.px').innerHTML = px.toFixed(1) + 'px　<span class="' + (px >= tr.__min ? 'pass' : 'fail') + '">' + (px >= tr.__min ? '通過' : '不足') + '</span>'; }); }

  /* ---------- 3. 按鈕矩陣 ---------- */
  const BTN = [['珊瑚（主要行動）', 'coral'], ['亮海洋', 'sea'], ['深海', 'deep'], ['薄荷（正向）', 'mint'], ['故事紫', 'violet'], ['陽光', 'gold'], ['錯誤／登出', 'danger'], ['次要（乳白）', 'ghost']];
  $('#t-btn-states tbody').innerHTML = BTN.map(([n, k]) => {
    const b = (cls, extra, label) => `<td><button class="ds-btn ds-btn--${k} ${cls}" type="button" ${extra || ''}>${label || '按鈕'}</button></td>`;
    return `<tr><th scope="row" style="white-space:nowrap">${n}</th>${b('')}${b('is-hover')}${b('is-pressed')}${b('is-focus-demo')}${b('', 'disabled', '<i data-icon="lock"></i>停用')}${b('is-loading', 'aria-busy="true" aria-disabled="true"', '<span class="ds-spinner" aria-hidden="true"></span><span>載入中</span>')}</tr>`;
  }).join('');
  $('#live-btn').addEventListener('click', function () {
    const btn = this; if (btn.classList.contains('is-loading')) return;
    UIKit.setLoading(btn, true, '送出中…'); $('#live-log').textContent = '';
    setTimeout(function () { UIKit.setLoading(btn, false); UIKit.hydrate(btn); $('#live-log').textContent = '已送出！'; }, 2000);
  });

  /* ---------- 4. 圖示 ---------- */
  const NAMES = Object.keys(UIKit.ICONS);
  $('#icon-grid').innerHTML = NAMES.map(n => `<div class="ic-cell">${UIKit.icon(n)}<code>${n}</code></div>`).join('');
  const IB = [['back', '上一頁'], ['map', '返回地圖'], ['book', '冒險日誌'], ['hint', '提示'], ['gear', '設定'], ['sound', '聽題目'], ['replay', '重播'], ['skip', '跳過'], ['captions', '字幕'], ['logout', '登出']];
  $('#iconbtns').innerHTML = IB.map(([i, t]) => `<button class="ds-iconbtn" type="button">${UIKit.icon(i)}<span>${t}</span></button>`).join('') + `<button class="ds-iconbtn" type="button" disabled>${UIKit.icon('lock')}<span>未解鎖</span></button>` + `<button class="ds-iconbtn ds-iconbtn--round" type="button" aria-label="關閉">${UIKit.icon('close')}</button>`;

  /* ---------- 5. 標籤 ---------- */
  $('#chips').innerHTML = [['success', 'check', '答對了'], ['info', 'info', '提示 1 / 3'], ['warn', 'warn', '再想一想'], ['danger', 'close', '需要再看一次']].map(([t, i, x]) => `<span class="ds-chip ds-chip--${t}">${UIKit.icon(i)}${x}</span>`).join('') + `<button class="ds-chip ds-chip--info ds-chip-btn" type="button">${UIKit.icon('hint')}看提示</button>`;

  /* ---------- 6. HUD ---------- */
  $('#hud-btns').innerHTML = `<button class="ds-iconbtn ds-iconbtn--row" type="button">${UIKit.icon('book')}冒險日誌</button><button class="ds-iconbtn ds-iconbtn--row" type="button">${UIKit.icon('gear')}設定</button><button class="ds-btn ds-btn--danger ds-btn--sm" type="button">${UIKit.icon('logout')}登出</button>`;

  /* ---------- 7. 島嶼 ---------- */
  const OP = { add: 'plus', sub: 'minus', mul: 'times', div: 'divide', wp: 'story', mix: 'parens' };
  const NM = { add: '加法島', sub: '減法島', mul: '乘法島', div: '除法島', wp: '應用題島', mix: '四則運算島' };
  function island(k, state, stars, lit, extra) {
    const stateTxt = { locked: '鎖定：先完成上一座島', open: '可以進入', current: '目前所在', done: '三區完成', perfect: '九星滿星' }[state];
    const stIcon = { locked: 'lock', open: 'next', current: 'compass', done: 'lighthouse', perfect: 'crown' }[state];
    return `<button class="ds-island" type="button" data-island="${k}" data-state="${state}" aria-label="${NM[k]}，${stateTxt}，${stars} 顆星，燈塔 ${lit} 之 3">` +
      `<span class="ds-island__art" aria-hidden="true">${UIKit.icon(state === 'locked' ? 'lock' : OP[k])}</span>` +
      `<span class="ds-island__plate">${NM[k]}</span>` +
      `<span class="ds-island__meta">${UIKit.starsHTML(Math.min(3, Math.ceil(stars / 3)), 3, { label: stars + ' 顆星，共 9 顆' })}<span class="ds-text-number">${lit}/3</span></span>` +
      `<span class="ds-island__state">${UIKit.icon(stIcon)}${stateTxt}</span></button>`;
  }
  $('#islands').innerHTML = ISL.map(([n, k], i) => island(k, i === 0 ? 'current' : (i < 3 ? 'open' : 'locked'), [5, 2, 0, 0, 0, 0][i], [2, 1, 0, 0, 0, 0][i])).join('');
  $('#island-states').innerHTML = [['locked', 0, 0], ['open', 0, 0], ['current', 3, 1], ['done', 7, 3], ['perfect', 9, 3]].map(([s, st, l]) => island('mul', s, st, l)).join('');

  /* ---------- 8. 星星與燈塔 ---------- */
  $('#lhs').innerHTML = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]].map(([l, c]) => `<div class="ds-lh-wrap">${UIKit.lighthouseHTML(l, { crown: !!c })}<span>${l}/3${c ? '＋星冠' : ''}</span></div>`).join('');
  $('#stars').innerHTML = [0, 1, 2, 3].map(n => `<span class="ds-chip">${UIKit.starsHTML(n, 3)}<span>${n} / 3</span></span>`).join('') + `<span class="ds-chip">${UIKit.starsHTML(7, 9).replace('class="ds-stars"', 'class="ds-stars ds-stars--nine"')}<span>7 / 9</span></span>`;

  /* ---------- 9. 對話框 ---------- */
  function wire(openId, overlayId) {
    const ov = $('#' + overlayId); $('#' + openId).addEventListener('click', function () { UIKit.openDialog(ov, this); });
    ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => UIKit.closeDialog(ov)));
  }
  wire('open-dialog', 'dlg'); wire('open-sheet', 'sheet');

  /* ---------- 圖示佔位 ---------- */
  UIKit.hydrate(document);

  /* ---------- 切換 ---------- */
  $('#sw-motion').addEventListener('change', e => root.classList.toggle('reduce-motion', e.target.checked));
  $('#sw-bg').addEventListener('change', e => { document.body.style.background = e.target.checked ? 'var(--ocean-deep)' : ''; document.querySelectorAll('.pg-sec > .lead, .pg-sec > h2').forEach(el => el.style.color = e.target.checked ? '#fff' : ''); });

  /* ---------- 自動檢查 ---------- */
  function runChecks() {
    const out = [];
    const add = (ok, msg) => out.push({ ok: !!ok, msg });
    add(rows.every(r => r.ok), '所有「文字／底色」組合都達到 WCAG AA（' + rows.filter(r => r.ok).length + ' / ' + rows.length + '）');
    const taps = Array.from(document.querySelectorAll('.ds-btn,.ds-iconbtn,.ds-island,.ds-chip-btn,.ds-input')).filter(el => el.offsetParent !== null && !el.closest('[hidden]'));
    const small = taps.filter(el => { const r = el.getBoundingClientRect(); return r.width < 47.5 || r.height < 47.5; });
    add(small.length === 0, '可點物件最小 48×48（檢查 ' + taps.length + ' 個' + (small.length ? '，不足：' + small.slice(0, 3).map(e => e.textContent.trim().slice(0, 8)).join('、') : '') + '）');
    const emptyIcons = NAMES.filter(n => !UIKit.ICONS[n] || UIKit.ICONS[n].length < 20);
    add(emptyIcons.length === 0, '圖示全部有內容（共 ' + NAMES.length + ' 個）');
    add(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(NAMES.map(n => UIKit.ICONS[n]).join('')), '圖示內沒有 emoji 字元（全部是 SVG 形狀）');
    const btn = document.querySelector('.ds-btn:not(:disabled)'); btn.focus();
    const cs = getComputedStyle(btn); add(parseFloat(cs.outlineWidth) >= 3 && cs.outlineStyle !== 'none', '焦點外框 ≥ 3px（實測 ' + cs.outlineWidth + ' ' + cs.outlineStyle + '）'); btn.blur();
    const fs = parseFloat(getComputedStyle(root.querySelector('.ds-text-body') || document.body).fontSize);
    add(fs >= (innerWidth < 600 ? 17 : 18) - 0.01, '正文字級 ' + fs.toFixed(1) + 'px（手機 ≥17、桌機 ≥18）');
    const btnFs = parseFloat(getComputedStyle(document.querySelector('.ds-btn--sm')).fontSize); add(btnFs >= 16, '最小按鈕文字 ' + btnFs.toFixed(1) + 'px（≥16）');
    add(document.documentElement.scrollWidth <= innerWidth + 1, '沒有水平捲動（頁寬 ' + document.documentElement.scrollWidth + ' ≤ 視窗 ' + innerWidth + '）');
    const imgsNoAlt = Array.from(document.querySelectorAll('svg[role="img"]:not([aria-label]),img:not([alt])')); add(imgsNoAlt.length === 0, '有意義的圖片都有文字說明');
    const labeled = Array.from(document.querySelectorAll('button')).filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')); add(labeled.length === 0, '沒有「只有圖示、沒有文字說明」的按鈕');
    $('#checks').innerHTML = out.map(o => `<li class="${o.ok ? 'chk-pass' : 'chk-fail'}">${esc(o.msg)}</li>`).join('');
    window.__ds_checks = out; return out;
  }
  refreshType(); runChecks();
  window.addEventListener('resize', function () { refreshType(); runChecks(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { refreshType(); runChecks(); });
})();
