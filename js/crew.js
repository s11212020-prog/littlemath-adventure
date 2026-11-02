/* ==========================================================================
   《小小算術家：六島大冒險》船員資料與原創角色圖（階段 4）
   - AvatarKit：六名原創小船員（全身 SVG，可換髮型色、制服色、胸章），沒有任何外部素材
   - 角色代碼：存在 progress.avatar，格式 "C3-2-1"（角色 3、制服色 2、胸章 1），不超過 8 個字
     （後端 mergeProgress_ 會把 avatar 截成 8 個字元，所以代碼要夠短）
   - 舊帳號：舊版存的是動物 emoji（🐶🐱🦊🐻🐰），不會被改寫；顯示時自動對應成同編號的船員圖
   - 日後換成精緻圖檔：AvatarKit.useImages({ C1: 'assets/characters/c1.svg', ... })，不必改任何功能程式
   只負責「畫角色」與「代碼轉換」，不碰學生資料、不呼叫後端。
   階段 9E-2（加法式修改）：svg() 多了選用參數 hair／uniform／noHat／noItem／head／hand／badges（船員小屋與裝備穿戴用），
   並公開 HAND_ANCHOR。沒有傳這些參數時，輸出和 9E-1 逐字相同（測試會逐字比對）。
   ========================================================================== */
const AvatarKit = (function () {
  'use strict';

  /* ---------- 1. 資料 ---------- */
  /* 六名船員：差異來自髮型、帽子、背包、手上的小道具；膚色與髮色各不相同，不和性別或族群綁定 */
  const CREW = [
    { id: 1, name: '小舵', color: 0, skin: '#F6CFA9', hair: '#2C2A55', pants: '#2B5C7C', look: '短髮、水手帽，舉著望遠鏡' },
    { id: 2, name: '阿帆', color: 1, skin: '#8D5A3B', hair: '#3B2417', pants: '#6B4A2E', look: '蓬鬆捲髮、橘色頭巾，背著大背包' },
    { id: 3, name: '浪花', color: 2, skin: '#E3A877', hair: '#8A3D2B', pants: '#2B5C7C', look: '兩個丸子頭，拿著小指南針' },
    { id: 4, name: '貝貝', color: 3, skin: '#C98B5E', hair: '#4A3426', pants: '#3A3F6B', look: '黃色漁夫帽，提著小救生圈' },
    { id: 5, name: '小錨', color: 4, skin: '#FFE0C7', hair: '#C25B3F', pants: '#2B5C7C', look: '長長直髮、船長帽，舉著小旗子' },
    { id: 6, name: '燈燈', color: 5, skin: '#A96E48', hair: '#2FA97F', pants: '#6B4A2E', look: '尖尖短髮、護目鏡，提著小提燈' }
  ];
  /* 制服顏色（六種都附文字名稱，不能只靠顏色分辨） */
  const COLORS = [
    { k: 'sea',    name: '海藍', main: '#2FA8E0', dark: '#1B7FB3' },
    { k: 'coral',  name: '珊瑚', main: '#FF7A59', dark: '#D95A3A' },
    { k: 'mint',   name: '薄荷', main: '#47C98B', dark: '#2E9A63' },
    { k: 'violet', name: '紫藤', main: '#8B6FE8', dark: '#6A4FD6' },
    { k: 'gold',   name: '陽光', main: '#FFD166', dark: '#D9A82E' },
    { k: 'pink',   name: '粉紅', main: '#FF9FB8', dark: '#E0728F' }
  ];
  const BADGES = [{ k: 'star', name: '星星' }, { k: 'anchor', name: '船錨' }, { k: 'lighthouse', name: '燈塔' }];
  /* 舊版動物 emoji → 同編號船員（只用來「顯示」，不會回寫進學生資料） */
  const LEGACY = { '🐶': 1, '🐱': 2, '🦊': 3, '🐻': 4, '🐰': 5 };
  const CODE_RE = /^C([1-6])-([0-5])-([0-2])$/;

  function defaultsFor(c) { return { c: c, col: CREW[c - 1].color, b: 0 }; }
  function encode(a) { return 'C' + a.c + '-' + a.col + '-' + a.b; }
  /** 代碼（或舊 emoji）→ {c, col, b, legacy}；空值或看不懂 → null */
  function parse(v) {
    if (v == null || v === '') return null;
    const s = String(v); const m = CODE_RE.exec(s);
    if (m) return { c: +m[1], col: +m[2], b: +m[3], legacy: false };
    if (LEGACY[s]) { const d = defaultsFor(LEGACY[s]); d.legacy = true; return d; }
    return null;
  }
  function describe(a) {
    const ch = CREW[a.c - 1]; return ch.name + '，' + COLORS[a.col].name + '色制服，' + BADGES[a.b].name + '胸章';
  }

  /* ---------- 2. 可替換圖檔 ---------- */
  const IMAGE_OVERRIDES = {};
  function useImages(map) { Object.keys(map || {}).forEach(function (k) { IMAGE_OVERRIDES[k] = map[k]; }); }

  /* ---------- 3. 圖形零件（座標：viewBox 0 0 120 190） ---------- */
  const INK = 'cw-ink'; // 描邊樣式在 css/entrance.css（.cw-*）

  function hairBack(c) {
    if (c === 2) return '<g class="cw-hair cw-ink"><circle cx="36" cy="40" r="13"/><circle cx="51" cy="29" r="14"/><circle cx="69" cy="29" r="14"/><circle cx="84" cy="40" r="13"/><circle cx="30" cy="56" r="9"/><circle cx="90" cy="56" r="9"/></g>';
    if (c === 3) return '<g class="cw-hair cw-ink"><circle cx="31" cy="30" r="12"/><circle cx="89" cy="30" r="12"/></g>';
    if (c === 5) return '<path class="cw-hair cw-ink" d="M27 54Q24 24 60 22Q96 24 93 54L96 106Q96 116 88 116H32Q24 116 24 106Z"/>';
    return '';
  }
  function hairFront(c) {
    if (c === 1) return '<path class="cw-hair cw-ink" d="M29 60Q26 28 60 27Q94 28 91 60Q88 44 74 41Q60 46 46 41Q32 44 29 60Z"/>';
    if (c === 2) return '<g class="cw-hair cw-ink"><circle cx="48" cy="38" r="9"/><circle cx="62" cy="34" r="10"/><circle cx="75" cy="39" r="9"/></g>';
    if (c === 3) return '<path class="cw-hair cw-ink" d="M29 62Q26 30 60 29Q94 30 91 62Q86 44 70 41Q60 48 50 41Q34 44 29 62Z"/><path class="cw-hl" d="M44 36Q52 32 60 33"/>';
    if (c === 4) return '<path class="cw-hair cw-ink" d="M30 58Q31 44 42 42Q50 50 60 42Q70 50 78 42Q89 44 90 58Q80 52 60 52Q40 52 30 58Z"/>';
    if (c === 5) return '<path class="cw-hair cw-ink" d="M29 62Q28 36 60 33Q92 36 91 62Q84 48 70 46Q58 54 44 46Q34 50 29 62Z"/>';
    if (c === 6) return '<path class="cw-hair cw-ink" d="M29 60Q24 30 48 27Q52 17 62 21Q70 14 76 24Q94 28 91 60Q80 46 60 46Q40 46 29 60Z"/>';
    return '';
  }
  function hat(c) {
    if (c === 1) return '<g class="cw-ink"><path class="cw-white" d="M33 42Q34 18 60 17Q86 18 87 42Z"/><path class="cw-navy" d="M29 42H91a4 4 0 0 1 0 9H29a4 4 0 0 1 0-9Z"/><circle class="cw-gold" cx="60" cy="31" r="5"/></g><path class="cw-stroke-soft" d="M44 26Q50 21 58 21"/>';
    if (c === 2) return '<g class="cw-ink"><path class="cw-outfit" d="M30 46Q60 33 90 46V55Q60 44 30 55Z"/><path class="cw-outfit" d="M86 49L100 44L97 56L103 63L88 59Z"/></g><g class="cw-dots"><circle cx="46" cy="44" r="2.2"/><circle cx="60" cy="42" r="2.2"/><circle cx="74" cy="44" r="2.2"/></g>';
    if (c === 4) return '<g class="cw-ink"><path class="cw-gold" d="M33 46Q32 18 60 18Q88 18 87 46Z"/><ellipse class="cw-gold-dk" cx="60" cy="47" rx="38" ry="8.5"/><path class="cw-stripe" d="M34 38H86"/></g>';
    if (c === 5) return '<g class="cw-ink"><path class="cw-white" d="M35 42Q36 17 60 16Q84 17 85 42Z"/><path class="cw-navy" d="M29 41H91a4 4 0 0 1 0 8H29a4 4 0 0 1 0-8Z"/><path class="cw-gold" d="M52 28h16l-8 8z"/></g>';
    if (c === 6) return '<g class="cw-ink"><path class="cw-navy" d="M29 37Q60 28 91 37V45Q60 36 29 45Z"/><circle class="cw-glass" cx="47" cy="38" r="9"/><circle class="cw-glass" cx="73" cy="38" r="9"/></g><path class="cw-hl cw-sm" d="M42 35Q44 32 48 32M68 35Q70 32 74 32"/>';
    return '';
  }
  function face(c) {
    return '<g><ellipse class="cw-ink cw-skin" cx="29" cy="62" rx="6" ry="7"/><ellipse class="cw-ink cw-skin" cx="91" cy="62" rx="6" ry="7"/>' +
      '<circle class="cw-ink cw-skin" cx="60" cy="58" r="31"/>' +
      '<ellipse class="cw-eye" cx="48" cy="60" rx="3.8" ry="5"/><ellipse class="cw-eye" cx="72" cy="60" rx="3.8" ry="5"/>' +
      '<circle class="cw-white-f" cx="49.4" cy="58" r="1.5"/><circle class="cw-white-f" cx="73.4" cy="58" r="1.5"/>' +
      '<ellipse class="cw-blush" cx="40" cy="71" rx="5.5" ry="3.3"/><ellipse class="cw-blush" cx="80" cy="71" rx="5.5" ry="3.3"/>' +
      '' + ((c === 2 || c === 6) ? '<path class="cw-ink cw-grin" d="M51 71Q60 85 69 71Z"/><path class="cw-tongue" d="M55 77Q60 82 65 77Q60 75 55 77Z"/>' : '<path class="cw-mouth" d="M52 72Q60 80 68 72"/>') + '</g>';
  }
  /* 手上的小道具：回傳 {back, front}，back 畫在身體後面，front 畫在手上 */
  function arms(c) {
    // 左臂 L、右臂 R 的路徑與手的位置
    let L = { d: 'M42 98Q31 110 31 126', h: [31, 128] }, R = { d: 'M78 98Q89 110 89 126', h: [89, 128] };
    if (c === 1) R = { d: 'M78 98Q97 100 95 82', h: [95, 80] };
    if (c === 2) L = { d: 'M42 98Q22 96 22 77', h: [22, 75] };
    if (c === 3) R = { d: 'M78 98Q92 108 92 124', h: [92, 126] };
    if (c === 5) R = { d: 'M78 98Q96 104 97 88', h: [97, 86] };
    const arm = function (a) {
      return '<path class="cw-armline" d="' + a.d + '"/><path class="cw-arm" d="' + a.d + '"/><circle class="cw-ink cw-skin" cx="' + a.h[0] + '" cy="' + a.h[1] + '" r="6.5"/>';
    };
    return { L: L, R: R, drawL: arm(L), drawR: arm(R) };
  }
  function item(c) {
    if (c === 1) return '<g transform="translate(95 80) rotate(-50)"><g class="cw-ink"><rect class="cw-navy" x="-12" y="-4.5" width="10" height="9" rx="3"/><rect class="cw-gold" x="-3" y="-6.5" width="27" height="13" rx="4"/><path class="cw-navy" d="M22-6.5L39-11V11L22 6.5Z"/></g><path class="cw-hl cw-sm" d="M4-2.5H18"/><ellipse class="cw-glass cw-ink" cx="39" cy="0" rx="2.6" ry="9"/></g>';
    if (c === 3) return '<g class="cw-ink"><circle class="cw-gold" cx="95" cy="134" r="12"/><circle class="cw-white" cx="95" cy="134" r="8.4"/></g><path class="cw-needle" d="M95 127L98 134L95 141L92 134Z"/><circle class="cw-ink cw-gold" cx="95" cy="134" r="1.8"/>';
    if (c === 4) return '<g transform="translate(20 130)"><circle class="cw-ring-w" r="11.5"/><circle class="cw-ring-c" r="11.5"/><circle class="cw-ink-ring" r="16"/><circle class="cw-ink-ring" r="7"/></g>';
    if (c === 5) return '<g class="cw-ink"><path class="cw-wood" d="M95 58h4.5V138H95z"/><path class="cw-coral-f" d="M99.5 59H118L112 68L118 77H99.5Z"/></g>';
    if (c === 6) return '<g transform="translate(31 138)"><path class="cw-hl-line" d="M-7 -1Q-7 -15 0 -15Q7 -15 7 -1"/><g class="cw-ink"><rect class="cw-gold-dk" x="-9" y="-2" width="18" height="5" rx="2"/><rect class="cw-lampglass" x="-8" y="3" width="16" height="15" rx="5"/><rect class="cw-gold-dk" x="-9" y="17" width="18" height="5" rx="2"/></g><path class="cw-flame" d="M0 6Q4.5 11 0 15Q-4.5 11 0 6Z"/></g>';
    return '';
  }
  function pack(c) {
    if (c !== 2) return '';
    return '<g class="cw-ink"><rect class="cw-brown" x="26" y="90" width="68" height="46" rx="14"/><rect class="cw-brown-dk" x="36" y="116" width="48" height="16" rx="6"/></g>';
  }
  /* 胸章圖案（座標以 0,0 為中心、半徑約 6） */
  const BADGE_ART = ['<path class="cw-sun-f" d="m0-6 1.8 3.8 4.2.6-3 3 .7 4.2L0 3.5-3.7 5.6-3 1.4-6-1.6l4.2-.6z"/>',
    '<path class="cw-ink-s" d="M0-5.5v11M-4 0h8M-5 3.5Q0 8 5 3.5"/><circle class="cw-ink-s cw-nofill" cx="0" cy="-5" r="1.7"/>',
    '<path class="cw-coral-f" d="M-2.8 5.5L-1.8-4h3.6L2.8 5.5Z"/><path class="cw-sun-f" d="M-3-4.6h6V-6.5l-3-1.4-3 1.4Z"/>'];
  function badge(b) {
    return '<g transform="translate(51 110)"><circle class="cw-ink cw-white" r="9.5"/>' + BADGE_ART[b] + '</g>';
  }
  /** 單獨的胸章小圖（給選項按鈕用） */
  function badgeSvg(b, size) {
    return '<svg class="cw-badge" viewBox="-11 -11 22 22" width="' + (size || 28) + '" height="' + (size || 28) + '" aria-hidden="true" focusable="false"><circle class="cw-ink cw-white" r="9.5"/>' + BADGE_ART[b] + '</svg>';
  }
  function body(c, o) {
    o = o || {};
    const a = arms(c);
    return '<ellipse class="cw-shadow" cx="60" cy="184" rx="31" ry="5"/>' +
      pack(c) +
      '<g class="cw-ink"><rect class="cw-pants" x="42" y="132" width="36" height="20" rx="8"/><rect class="cw-skin" x="45" y="146" width="12" height="22" rx="5"/><rect class="cw-skin" x="63" y="146" width="12" height="22" rx="5"/>' +
      '<path class="cw-shoe" d="M39 172a7 7 0 0 1 7-7h11a4 4 0 0 1 4 4v8a3 3 0 0 1-3 3H43a4 4 0 0 1-4-4Z"/><path class="cw-shoe" d="M81 172a7 7 0 0 0-7-7H63a4 4 0 0 0-4 4v8a3 3 0 0 0 3 3h15a4 4 0 0 0 4-4Z"/></g>' +
      (c === 4 && !o.noItem ? item(4) : '') +
      a.drawL +
      '<path class="cw-ink cw-outfit" d="M38 94Q38 83 49 83H71Q82 83 82 94V133Q82 141 74 141H46Q38 141 38 133Z"/>' +
      '<path class="cw-shade" d="M38 120H82V133Q82 141 74 141H46Q38 141 38 133Z"/>' +
      '<path class="cw-ink cw-collar" d="M47 84L60 101L73 84Z"/>' +
      (c === 2 ? '<path class="cw-strap" d="M47 85V132M73 85V132"/>' : '') +
      '<path class="cw-belt" d="M39 131H81"/>' +
      a.drawR;
  }

  /* ---------- 4. 組合成 SVG ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function inner(a, o) {
    const c = a.c; o = o || {};
    return hairBack(c) + body(c, o) + (c === 4 ? '' : '') + badge(a.b) + (o.badges || '') + face(c) + hairFront(c) + (o.noHat ? '' : hat(c)) + (o.head || '') + ((c === 4 || o.noItem) ? '' : item(c)) + (o.hand || '');
  }
  /* 9E-2：每名船員「手上道具」的握點 [x, y, 旋轉角]（角色座標 120x190），手持裝備用 */
  const HAND_ANCHOR = { 1: [95, 80, -25], 2: [22, 75, 15], 3: [92, 126, 0], 4: [31, 128, 0], 5: [97, 86, 8], 6: [31, 132, 0] };
  /**
   * 回傳角色 SVG（字串）。
   * v：代碼 "C3-2-1"（或舊 emoji、或 {c,col,b}）；opt.view：'full'（全身，預設）或 'bust'（半身，給小頭像）；
   * opt.label === false → 純裝飾（aria-hidden）；否則自動產生「小舵，海藍色制服，星星胸章」之類的替代文字。
   * 9E-2 選用：opt.hair（'#RRGGBB'）、opt.uniform（COLORS 的一項）、opt.noHat、opt.noItem、opt.head／opt.hand／opt.badges（已組好的 SVG 片段）。
   */
  function svg(v, opt) {
    opt = opt || {};
    const a = (v && typeof v === 'object') ? v : (parse(v) || defaultsFor(1));
    const col = opt.uniform || COLORS[a.col], ch = CREW[a.c - 1];
    const override = IMAGE_OVERRIDES['C' + a.c];
    const alt = opt.label === false ? '' : (opt.label || describe(a));
    const cls = 'cw cw--' + (opt.view === 'bust' ? 'bust' : 'full') + (opt.className ? ' ' + opt.className : '');
    if (override) return '<img class="' + cls + '" src="' + esc(override) + '" alt="' + esc(alt) + '" draggable="false">';
    const vb = opt.view === 'bust' ? '12 8 96 104' : '0 0 120 190';
    const style = '--cw-outfit:' + col.main + ';--cw-outfit-dk:' + col.dark + ';--cw-skin:' + ch.skin + ';--cw-hair:' + (opt.hair || ch.hair) + ';--cw-pants:' + ch.pants;
    const a11y = alt ? ' role="img" aria-label="' + esc(alt) + '"' : ' aria-hidden="true"';
    return '<svg class="' + cls + '" viewBox="' + vb + '" focusable="false"' + a11y + ' style="' + style + '">' + inner(a, opt) + '</svg>';
  }

  /** 地圖上方的小頭像／小船上的頭像：有角色就畫半身，沒有就用通用船員圖示（不使用 emoji） */
  function bustHTML(v, px) {
    const a = (v && typeof v === 'object') ? v : parse(v);
    if (!a) return (typeof UIKit !== 'undefined') ? UIKit.icon('crew', { size: px }) : '';
    return svg(a, { view: 'bust', label: false }).replace('<svg ', '<svg width="' + px + '" height="' + Math.round(px * 104 / 96) + '" ');
  }

  return { version: '1.0.0', HAND_ANCHOR: HAND_ANCHOR, CREW: CREW, COLORS: COLORS, BADGES: BADGES, LEGACY: LEGACY, defaultsFor: defaultsFor, encode: encode, parse: parse, describe: describe, svg: svg, bustHTML: bustHTML, badgeSvg: badgeSvg, useImages: useImages };
})();
