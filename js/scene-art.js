/* ==========================================================================
   《小小算術家：六島大冒險》階段 6.1：六島「島內背景場景」（原創 SVG，純顯示、離線可用）
   - 只負責畫背景：加法島＝青蛙池塘、減法島＝玩具收納港、乘法島＝花盆種植園、
     除法島＝糖果分享海灘、應用題島＝故事書村、四則運算島＝秩序神殿。
   - 每座島兩層：sc-sky（上方：垂柳、海鷗、向日葵、彩旗、對話泡泡、神殿旗幟）＋ sc-ground（下方：主場景）。
   - 全部是 aria-hidden、pointer-events:none、淡色（透明度由 island.css 的 --island-scene-o 控制，約 17%）。
   - 環境動畫（水波、水流、繩子、風車、彩旗、書頁、光點）都寫在 island.css，減少動態時全部停止。
   - 不含任何文字、算式或答案；不使用 emoji；沒有外部圖片網址。
   - 可替換：日後要換成設計師的圖檔，呼叫 SceneArt.useImages({ add: 'assets/scenes/add.svg', ... }) 即可。
   ========================================================================== */
const SceneArt = (function () {
  'use strict';
  const KEYS = ['add', 'sub', 'mul', 'div', 'wp', 'mix'];
  let IMAGES = null;
  const n = function (v) { return Math.round(v * 10) / 10; };
  const svg = function (cls, vb, par, inner) {
    return '<svg class="sc-layer ' + cls + '" viewBox="' + vb + '" preserveAspectRatio="' + par + '" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  };
  const SKY = function (inner) { return svg('sc-sky', '0 0 1000 220', 'xMidYMin meet', inner); };
  const GROUND = function (inner) { return svg('sc-ground', '0 0 1000 420', 'xMidYMax meet', inner); };
  const poly = function (pts, fill, extra) { return '<polygon points="' + pts + '" fill="' + fill + '" ' + (extra || '') + '/>'; };
  const line = function (x1, y1, x2, y2, c, w) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"/>'; };
  /* 二次貝茲曲線上的點（畫彩旗用） */
  const qpt = function (p0, p1, p2, t) { const a = 1 - t; return { x: a * a * p0.x + 2 * a * t * p1.x + t * t * p2.x, y: a * a * p0.y + 2 * a * t * p1.y + t * t * p2.y }; };

  /* ====================== 加法島：青蛙池塘 ====================== */
  function addScene() {
    const W = '#35B3D6', W2 = '#86D6E4', GR = '#A5DC8A', LP = '#3FAE6A', RD = '#3E9C6B', FROG = '#4CBF6B';
    const flower = function (x, y, s) {
      let h = ''; for (let a = 0; a < 360; a += 72) h += '<ellipse cx="' + n(x) + '" cy="' + n(y - s) + '" rx="' + n(s * .45) + '" ry="' + n(s * .9) + '" fill="#F6A5C0" transform="rotate(' + a + ' ' + n(x) + ' ' + n(y) + ')"/>';
      return h + '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(s * .42) + '" fill="#FFE27A"/>';
    };
    const pad = function (x, y, r, fl, d) {
      return '<g class="sc-bob" style="animation-delay:-' + d + 's"><ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + n(r * .42) + '" fill="' + LP + '"/>' +
        '<path d="M' + x + ' ' + y + ' L' + n(x + r * .95) + ' ' + n(y - r * .16) + ' L' + n(x + r * .95) + ' ' + n(y + r * .16) + ' Z" fill="' + W + '"/>' + (fl ? flower(x - r * .3, y - r * .08, r * .26) : '') + '</g>';
    };
    const reed = function (x, h, lean) {
      const tx = x + lean, ty = 430 - h;
      return '<path d="M' + x + ' 430 Q' + n(x + lean / 2) + ' ' + n(430 - h / 2) + ' ' + tx + ' ' + ty + '" stroke="' + RD + '" stroke-width="6" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="' + tx + '" cy="' + (ty - 12) + '" rx="7" ry="19" fill="#8A5A32" transform="rotate(' + n(lean * .35) + ' ' + tx + ' ' + (ty - 12) + ')"/>' +
        '<path d="M' + x + ' 430 Q' + n(x - 24) + ' ' + n(430 - h * .5) + ' ' + n(x - 34) + ' ' + n(430 - h * .62) + '" stroke="' + RD + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    };
    const print = function (x, y, r) {
      return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ')" fill="#6FC77F"><ellipse cx="0" cy="0" rx="8" ry="10"/><circle cx="-12" cy="-13" r="4.2"/><circle cx="0" cy="-17" r="4.2"/><circle cx="12" cy="-13" r="4.2"/></g>';
    };
    const streams = ['M-60 90 C120 120 210 150 262 214 C300 262 340 282 400 300', 'M1060 70 C900 112 820 150 764 214 C724 258 672 282 612 300'];
    let g = '<path d="M-400 150 Q200 96 500 126 T1400 136 L1400 560 L-400 560 Z" fill="' + GR + '"/>';
    streams.forEach(function (d) { g += '<path d="' + d + '" stroke="' + W + '" stroke-width="34" fill="none" stroke-linecap="round"/>'; });
    g += '<ellipse cx="500" cy="388" rx="560" ry="132" fill="' + W + '"/><ellipse cx="500" cy="394" rx="470" ry="96" fill="' + W2 + '"/>';
    streams.forEach(function (d) { g += '<path class="sc-flow" d="' + d + '" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="2 26"/>'; });
    [[470, 336, 74, 11, 0], [715, 366, 90, 12, 3], [290, 378, 80, 12, 5.5]].forEach(function (r) {
      g += '<ellipse class="sc-ripple" cx="' + r[0] + '" cy="' + r[1] + '" rx="' + r[2] + '" ry="' + r[3] + '" fill="none" stroke="#fff" stroke-width="4" style="animation-delay:-' + r[4] + 's"/>';
    });
    g += pad(400, 368, 48, true, 1) + pad(566, 346, 38, false, 3) + pad(690, 398, 54, true, 5) + pad(240, 404, 42, false, 2) + pad(830, 366, 34, false, 4);
    g += '<g transform="translate(566 334)" fill="' + FROG + '"><ellipse cx="0" cy="4" rx="22" ry="13"/><ellipse cx="-17" cy="12" rx="9" ry="5"/><ellipse cx="17" cy="12" rx="9" ry="5"/><circle cx="-11" cy="-9" r="7.5"/><circle cx="11" cy="-9" r="7.5"/><circle cx="-11" cy="-10" r="3" fill="#fff"/><circle cx="11" cy="-10" r="3" fill="#fff"/></g>';
    g += [reed(38, 190, 12), reed(82, 236, -8), reed(128, 168, 10), reed(900, 214, -10), reed(946, 172, 8), reed(988, 244, -12), reed(-30, 200, 10), reed(-78, 150, -8), reed(1036, 190, -10), reed(1082, 232, 8)].join('');
    g += print(468, 150, -8) + print(506, 178, 10) + print(474, 206, -6) + print(512, 234, 8);
    return GROUND(g);
  }
  function addSky() {
    const WL = '#3E9C6B'; let g = '';
    [[26, 1], [974, -1]].forEach(function (c) {
      const x = c[0], s = c[1];
      for (let i = 0; i < 4; i++) {
        const x0 = x + s * i * 30, len = 120 + (i % 2) * 54;
        g += '<path d="M' + x0 + ' -4 C' + (x0 - s * 14) + ' ' + n(len * .35) + ' ' + (x0 + s * 8) + ' ' + n(len * .7) + ' ' + (x0 - s * 4) + ' ' + len + '" stroke="' + WL + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
        for (let k = 1; k <= 4; k++) { const yy = n(len * k / 5); g += '<ellipse cx="' + (x0 - s * 6 + (k % 2 ? 7 : -7)) + '" cy="' + yy + '" rx="5.5" ry="13" fill="#6FC77F" transform="rotate(' + (k % 2 ? 28 : -28) + ' ' + (x0 - s * 6) + ' ' + yy + ')"/>'; }
      }
    });
    return SKY(g);
  }

  /* ====================== 減法島：玩具收納港 ====================== */
  function subScene() {
    const WOOD = '#C48A4E', WD = '#8A5A32', CORAL = '#FF7A59', SKYB = '#4DA8E0', YEL = '#FFD166', GRN = '#47C98B';
    const bear = function (x, y, s, c) { return '<g fill="' + c + '"><circle cx="' + n(x - 11 * s) + '" cy="' + n(y - 11 * s) + '" r="' + n(6 * s) + '"/><circle cx="' + n(x + 11 * s) + '" cy="' + n(y - 11 * s) + '" r="' + n(6 * s) + '"/><circle cx="' + x + '" cy="' + y + '" r="' + n(14 * s) + '"/><ellipse cx="' + x + '" cy="' + n(y + 5 * s) + '" rx="' + n(6 * s) + '" ry="' + n(4.5 * s) + '" fill="#fff" opacity=".6"/></g>'; };
    const duck = function (x, y, s, c) { return '<g fill="' + c + '"><ellipse cx="' + x + '" cy="' + y + '" rx="' + n(16 * s) + '" ry="' + n(11 * s) + '"/><circle cx="' + n(x + 10 * s) + '" cy="' + n(y - 12 * s) + '" r="' + n(8 * s) + '"/><path d="M' + n(x + 17 * s) + ' ' + n(y - 13 * s) + ' l' + n(10 * s) + ' ' + n(3 * s) + ' l' + n(-10 * s) + ' ' + n(4 * s) + ' z" fill="#FF9F43"/></g>'; };
    const ball = function (x, y, r, c) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"/><path d="M' + (x - r) + ' ' + y + ' Q' + x + ' ' + n(y - r * .8) + ' ' + (x + r) + ' ' + y + '" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>'; };
    const car = function (x, y, s, c) { return '<g><rect x="' + x + '" y="' + n(y - 13 * s) + '" width="' + n(40 * s) + '" height="' + n(12 * s) + '" rx="' + n(4 * s) + '" fill="' + c + '"/><rect x="' + n(x + 9 * s) + '" y="' + n(y - 23 * s) + '" width="' + n(20 * s) + '" height="' + n(11 * s) + '" rx="' + n(4 * s) + '" fill="' + c + '"/><circle cx="' + n(x + 9 * s) + '" cy="' + n(y - 1 * s) + '" r="' + n(5 * s) + '" fill="#4A5B6E"/><circle cx="' + n(x + 31 * s) + '" cy="' + n(y - 1 * s) + '" r="' + n(5 * s) + '" fill="#4A5B6E"/></g>'; };
    const rocket = function (x, y, s, c) { return '<g fill="' + c + '"><path d="M' + x + ' ' + n(y - 30 * s) + ' C' + n(x + 12 * s) + ' ' + n(y - 18 * s) + ' ' + n(x + 12 * s) + ' ' + n(y - 4 * s) + ' ' + n(x + 9 * s) + ' ' + n(y + 6 * s) + ' H' + n(x - 9 * s) + ' C' + n(x - 12 * s) + ' ' + n(y - 4 * s) + ' ' + n(x - 12 * s) + ' ' + n(y - 18 * s) + ' ' + x + ' ' + n(y - 30 * s) + ' Z"/><path d="M' + n(x - 9 * s) + ' ' + n(y + 2 * s) + ' l' + n(-9 * s) + ' ' + n(10 * s) + ' h' + n(9 * s) + ' z M' + n(x + 9 * s) + ' ' + n(y + 2 * s) + ' l' + n(9 * s) + ' ' + n(10 * s) + ' h' + n(-9 * s) + ' z"/><circle cx="' + x + '" cy="' + n(y - 16 * s) + '" r="' + n(4.5 * s) + '" fill="#fff" opacity=".75"/></g>'; };
    const block = function (x, y, s, c) { return '<g fill="' + c + '"><rect x="' + x + '" y="' + n(y - 20 * s) + '" width="' + n(26 * s) + '" height="' + n(20 * s) + '" rx="' + n(3 * s) + '"/><circle cx="' + n(x + 7 * s) + '" cy="' + n(y - 24 * s) + '" r="' + n(4 * s) + '"/><circle cx="' + n(x + 19 * s) + '" cy="' + n(y - 24 * s) + '" r="' + n(4 * s) + '"/></g>'; };
    const crate = function (x, y, s) { return '<g><rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" rx="5" fill="' + WOOD + '" stroke="' + WD + '" stroke-width="5"/>' + line(x + 6, y + 6, x + s - 6, y + s - 6, WD, 4) + line(x + s - 6, y + 6, x + 6, y + s - 6, WD, 4) + '</g>'; };
    let wave = ''; for (let k = -2; k < 40; k++) wave += 'q12 -9 24 0 ';
    let planks = ''; for (let x = -560; x < 1500; x += 70) planks += line(x, 320, x, 360, '#7E5228', 3);
    let g = '<rect x="-600" y="352" width="2200" height="120" fill="' + SKYB + '"/>' +
      '<path d="M-50 376 ' + wave + '" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M-20 398 ' + wave + '" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
      '<g transform="translate(500 372)"><path d="M-40 6 H40 L28 24 H-28 Z" fill="#fff"/><line x1="0" y1="6" x2="0" y2="-48" stroke="' + WD + '" stroke-width="3"/><path d="M4 -44 L4 0 L36 0 Z" fill="' + CORAL + '"/></g>' +
      '<rect x="-600" y="318" width="2200" height="44" fill="#A8743F"/>' + planks + '<rect x="-600" y="318" width="2200" height="6" fill="#D4A06A"/>';
    /* 倉庫 */
    g += '<rect x="40" y="178" width="270" height="140" fill="#E58463" stroke="' + WD + '" stroke-width="4"/>' + poly('18,184 175,108 332,184', WD) + '<rect x="132" y="232" width="86" height="86" fill="' + WOOD + '" stroke="' + WD + '" stroke-width="4"/>' + line(132, 232, 218, 318, WD, 4) + line(218, 232, 132, 318, WD, 4) +
      '<rect x="62" y="206" width="44" height="34" rx="4" fill="#CBEBFA" stroke="' + WD + '" stroke-width="4"/><rect x="246" y="206" width="44" height="34" rx="4" fill="#CBEBFA" stroke="' + WD + '" stroke-width="4"/>' +
      '<circle cx="175" cy="170" r="17" fill="#fff" stroke="' + WD + '" stroke-width="3"/>' + block(167, 178, .62, CORAL) +
      '<g transform="translate(325 262)"><circle r="26" fill="#fff" stroke="' + CORAL + '" stroke-width="9"/><circle r="8" fill="' + CORAL + '"/></g>';
    /* 收納架 */
    g += '<rect x="356" y="168" width="9" height="150" fill="' + WD + '"/><rect x="552" y="168" width="9" height="150" fill="' + WD + '"/><rect x="352" y="214" width="214" height="9" fill="#A8743F"/><rect x="352" y="266" width="214" height="9" fill="#A8743F"/>' +
      bear(392, 198, .9, CORAL) + car(432, 213, .9, SKYB) + ball(520, 200, 13, YEL) +
      '<rect x="368" y="236" width="40" height="30" rx="3" fill="' + WOOD + '" stroke="' + WD + '" stroke-width="3"/>' + duck(452, 254, .95, YEL) + block(494, 266, 1, GRN) + rocket(540, 258, .8, CORAL);
    /* 木箱＋探頭的玩具（不破損、不悲傷） */
    g += bear(-112, 190, 1, YEL) + crate(-150, 246, 72) + crate(-74, 256, 62) + crate(1050, 252, 66) + duck(1083, 258, 1, SKYB) + ball(1150, 306, 12, CORAL) + bear(640, 186, 1, SKYB) + duck(714, 258, 1.05, CORAL) + crate(602, 242, 76) + crate(682, 252, 66) + crate(612, 182, 60) + ball(776, 306, 12, GRN);
    /* 起重機＋繩子 */
    g += '<rect x="838" y="298" width="74" height="22" rx="4" fill="' + WD + '"/><rect x="864" y="70" width="22" height="232" fill="#F2A23A"/>';
    for (let y = 92; y < 290; y += 38) g += line(864, y, 886, y + 38, '#C97B1A', 3) + line(886, y, 864, y + 38, '#C97B1A', 3);
    g += '<rect x="690" y="62" width="256" height="16" rx="3" fill="#F2A23A"/><rect x="902" y="52" width="44" height="38" rx="4" fill="' + WD + '"/>' + line(875, 62, 700, 70, WD, 3) +
      '<g class="sc-rope"><line x1="730" y1="78" x2="730" y2="198" stroke="#5A4630" stroke-width="4" stroke-linecap="round"/><path d="M721 196 h18 v10 a9 9 0 0 1 -18 0 z" fill="#5A4630"/>' + crate(706, 214, 48) + '</g>';
    /* 港口繩索 */
    g += '<rect x="400" y="298" width="22" height="22" rx="4" fill="' + WD + '"/><rect x="394" y="292" width="34" height="9" rx="4" fill="#5A4630"/><path d="M411 300 C 440 330 480 330 500 354" stroke="#E8D3A0" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="9 4"/>';
    return GROUND(g);
  }
  function subSky() {
    const gull = function (x, y, s) { return '<path d="M' + x + ' ' + y + ' q' + 14 * s + ' ' + -16 * s + ' ' + 28 * s + ' 0 q' + 14 * s + ' ' + -16 * s + ' ' + 28 * s + ' 0" stroke="#5A7A98" stroke-width="4" fill="none" stroke-linecap="round"/>'; };
    return SKY(gull(210, 74, 1) + gull(272, 40, .8) + gull(760, 96, .9) +
      '<g transform="translate(70 70)"><circle r="30" fill="#fff" stroke="#FF7A59" stroke-width="12"/><circle r="30" fill="none" stroke="#fff" stroke-width="12" stroke-dasharray="24 24"/></g>' +
      '<path d="M70 -4 V40" stroke="#8A5A32" stroke-width="3"/>');
  }

  /* ====================== 乘法島：花盆種植園 ====================== */
  function mulScene() {
    const TERRA = '#B5621F', SOIL = '#A9764A', LEAF = '#3F8F2A';
    const petals = function (x, y, r, c) { let h = ''; for (let a = 0; a < 360; a += 40) h += '<ellipse cx="' + x + '" cy="' + n(y - r * .78) + '" rx="' + n(r * .22) + '" ry="' + n(r * .42) + '" fill="' + c + '" transform="rotate(' + a + ' ' + x + ' ' + y + ')"/>'; return h + '<circle cx="' + x + '" cy="' + y + '" r="' + n(r * .46) + '" fill="#7A4A24"/>'; };
    /* kind: 0=種子、1=發芽、2=幼苗、3=向日葵 */
    const pot = function (x, y, s, kind) {
      let h = '';
      if (kind >= 1) h += '<path d="M' + x + ' ' + n(y + 2 * s) + ' V' + n(y - (kind === 1 ? 14 : 30) * s) + '" stroke="' + LEAF + '" stroke-width="' + n(4 * s) + '" fill="none" stroke-linecap="round"/>';
      if (kind === 1) h += '<ellipse cx="' + n(x - 7 * s) + '" cy="' + n(y - 14 * s) + '" rx="' + n(8 * s) + '" ry="' + n(4 * s) + '" fill="' + LEAF + '" transform="rotate(-25 ' + n(x - 7 * s) + ' ' + n(y - 14 * s) + ')"/>';
      if (kind === 2) h += '<ellipse cx="' + n(x - 10 * s) + '" cy="' + n(y - 22 * s) + '" rx="' + n(11 * s) + '" ry="' + n(5 * s) + '" fill="' + LEAF + '" transform="rotate(-28 ' + n(x - 10 * s) + ' ' + n(y - 22 * s) + ')"/><ellipse cx="' + n(x + 10 * s) + '" cy="' + n(y - 28 * s) + '" rx="' + n(11 * s) + '" ry="' + n(5 * s) + '" fill="' + LEAF + '" transform="rotate(28 ' + n(x + 10 * s) + ' ' + n(y - 28 * s) + ')"/>';
      if (kind === 3) h += petals(x, n(y - 40 * s), 15 * s, '#FFC93C');
      if (kind === 0) h += '<ellipse cx="' + n(x - 5 * s) + '" cy="' + n(y - 1 * s) + '" rx="' + n(3.4 * s) + '" ry="' + n(2 * s) + '" fill="#6B4423"/><ellipse cx="' + n(x + 5 * s) + '" cy="' + n(y - 2 * s) + '" rx="' + n(3.4 * s) + '" ry="' + n(2 * s) + '" fill="#6B4423" transform="rotate(30 ' + n(x + 5 * s) + ' ' + n(y - 2 * s) + ')"/>';
      return h + '<path d="M' + n(x - 15 * s) + ' ' + y + ' H' + n(x + 15 * s) + ' L' + n(x + 11 * s) + ' ' + n(y + 24 * s) + ' H' + n(x - 11 * s) + ' Z" fill="' + TERRA + '"/><rect x="' + n(x - 17 * s) + '" y="' + n(y - 3 * s) + '" width="' + n(34 * s) + '" height="' + n(8 * s) + '" rx="' + n(3 * s) + '" fill="#DB9158"/>';
    };
    let g = '<ellipse cx="260" cy="440" rx="560" ry="190" fill="#9BD35A"/><ellipse cx="800" cy="446" rx="520" ry="170" fill="#86C440"/>' +
      '<path d="M-400 290 Q500 252 1400 290 L1400 560 L-400 560 Z" fill="' + SOIL + '"/>' +
      poly('430,430 570,430 516,272 484,272', '#F4E6B8') + line(500, 424, 500, 284, '#D8C48C', 3).replace('stroke-linecap="round"', 'stroke-dasharray="10 14"');
    /* 等組排列：左右各 3 列 × 3 盆，整齊對稱（每組一樣多） */
    const rows = [{ y: 308, s: .72, xs: [-20, 60, 140, 215, 290], k: 0 }, { y: 350, s: .9, xs: [-70, 18, 112, 206, 300], k: 1 }, { y: 392, s: 1.06, xs: [-120, -30, 70, 186, 302], k: 2 }];
    rows.forEach(function (r) { r.xs.forEach(function (x) { g += pot(x, r.y, r.s, r.k) + pot(1000 - x, r.y, r.s, r.k); }); });
    /* 散落的種子 */
    [[430, 340], [455, 380], [548, 354], [572, 396], [412, 318], [592, 324]].forEach(function (p) { g += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="6" ry="3.4" fill="#6B4423" transform="rotate(' + (p[0] % 50) + ' ' + p[0] + ' ' + p[1] + ')"/>'; });
    /* 高高的向日葵 */
    [[26, 210], [976, 236], [-96, 190], [1096, 214]].forEach(function (s) { g += '<path d="M' + s[0] + ' 430 V' + (430 - s[1]) + '" stroke="' + LEAF + '" stroke-width="8" stroke-linecap="round"/>' + petals(s[0], 430 - s[1] - 8, 38, '#FFC93C'); });
    /* 小風車 */
    g += '<g transform="translate(884 196)"><path d="M-22 90 L-14 0 H14 L22 90 Z" fill="#F6EBD0" stroke="#B58A5A" stroke-width="4"/><path d="M-20 0 L0 -26 L20 0 Z" fill="' + TERRA + '"/><rect x="-6" y="48" width="12" height="42" rx="3" fill="#B58A5A"/>' +
      '<g class="sc-spin"><rect x="-6" y="-84" width="12" height="80" rx="3" fill="#fff" stroke="#B58A5A" stroke-width="3"/><rect x="-6" y="4" width="12" height="80" rx="3" fill="#fff" stroke="#B58A5A" stroke-width="3" transform="translate(0 -0)"/><rect x="-84" y="-6" width="80" height="12" rx="3" fill="#fff" stroke="#B58A5A" stroke-width="3"/><rect x="4" y="-6" width="80" height="12" rx="3" fill="#fff" stroke="#B58A5A" stroke-width="3"/></g><circle r="9" fill="#B58A5A"/></g>';
    return GROUND(g);
  }
  function mulSky() {
    const petals = function (x, y, r) { let h = ''; for (let a = 0; a < 360; a += 30) h += '<ellipse cx="' + x + '" cy="' + n(y - r * .78) + '" rx="' + n(r * .2) + '" ry="' + n(r * .4) + '" fill="#FFC93C" transform="rotate(' + a + ' ' + x + ' ' + y + ')"/>'; return h + '<circle cx="' + x + '" cy="' + y + '" r="' + n(r * .46) + '" fill="#7A4A24"/>'; };
    return SKY(petals(54, 18, 74) + petals(950, 4, 60) + petals(-110, 40, 56) + petals(1110, 30, 50) +
      '<g fill="#6B4423"><ellipse cx="430" cy="60" rx="6" ry="3.4" transform="rotate(40 430 60)"/><ellipse cx="570" cy="100" rx="6" ry="3.4" transform="rotate(-30 570 100)"/><ellipse cx="660" cy="44" rx="6" ry="3.4"/></g>');
  }

  /* ====================== 除法島：糖果分享海灘 ====================== */
  function divScene() {
    const candy = function (x, y, rot, c) { return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"><path d="M-9 0 L-21 -8 V8 Z M9 0 L21 -8 V8 Z" fill="' + c + '"/><ellipse rx="12" ry="8.5" fill="' + c + '"/><path d="M-4 -7 Q0 0 -4 7" stroke="#fff" stroke-width="2.4" fill="none" opacity=".8"/></g>'; };
    const plate = function (x, y, cs) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="44" ry="13" fill="#fff" stroke="#B79CF0" stroke-width="3"/><ellipse cx="' + x + '" cy="' + (y - 1) + '" rx="30" ry="8" fill="#F3ECFF"/>' + candy(x - 13, y - 4, -12, cs[0]) + candy(x + 14, y - 3, 10, cs[1]); };
    const seat = function (x, y, c) { return '<ellipse cx="' + x + '" cy="' + (y + 10) + '" rx="40" ry="16" fill="' + c + '" opacity=".9"/><ellipse cx="' + x + '" cy="' + y + '" rx="38" ry="19" fill="' + c + '"/><ellipse cx="' + x + '" cy="' + (y - 2) + '" rx="22" ry="9" fill="#fff" opacity=".5"/>'; };
    let wave = ''; for (let k = -2; k < 40; k++) wave += 'q12 -9 24 0 ';
    let g = '<rect x="-600" y="236" width="2200" height="80" fill="#A9DDF2"/><path d="M-50 262 ' + wave + '" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M-20 286 ' + wave + '" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M-400 304 Q200 264 500 290 T1400 284 L1400 560 L-400 560 Z" fill="#FBE4A8"/>';
    /* 遮陽傘 */
    g += '<clipPath id="scg-umb"><path d="M-14 214 A84 76 0 0 1 154 214 Z"/></clipPath><rect x="68" y="216" width="6" height="112" fill="#9B6A3F"/>' +
      '<g clip-path="url(#scg-umb)"><rect x="-14" y="130" width="168" height="90" fill="#F28DB6"/><rect x="14" y="130" width="28" height="90" fill="#FFF6D9"/><rect x="70" y="130" width="28" height="90" fill="#FFF6D9"/><rect x="126" y="130" width="28" height="90" fill="#FFF6D9"/></g>';
    /* 大棒棒糖 */
    g += line(902, 262, 902, 336, '#D8B88A', 7) + '<circle cx="902" cy="226" r="38" fill="#B79CF0"/><path d="M902 226 m0 -6 a6 6 0 1 1 -6 6 a14 14 0 1 1 14 14 a24 24 0 1 1 -24 -24" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>';
    /* 朋友座位（圓墊子，圍著野餐墊） */
    g += seat(-60, 372, '#8FD3E8') + seat(1060, 372, '#B79CF0') + '<g transform="translate(-120 0)"><circle cx="60" cy="380" r="26" fill="#F28DB6"/><path d="M34 380 H86 M60 354 V406" stroke="#fff" stroke-width="5"/></g>' + seat(118, 384, '#B79CF0') + seat(196, 338, '#8FD3E8') + seat(804, 338, '#FFD98A') + seat(882, 384, '#F28DB6');
    /* 野餐墊：六條粉紅／奶油交錯的條紋 */
    for (let i = 0; i < 6; i++) g += poly((200 + 100 * i) + ',405 ' + (300 + 100 * i) + ',405 ' + n(386.7 + 56.7 * i) + ',332 ' + n(330 + 56.7 * i) + ',332', i % 2 ? '#FFF6D9' : '#F6A5C8');
    /* 每個盤子 2 顆糖：平均分配 */
    g += plate(396, 372, ['#F28DB6', '#8FD3E8']) + plate(500, 378, ['#B79CF0', '#FFD98A']) + plate(604, 372, ['#8FD3E8', '#F28DB6']);
    return GROUND(g);
  }
  function divSky() {
    const P0 = { x: -20, y: 6 }, P1 = { x: 250, y: 120 }, P2 = { x: 520, y: 24 }, Q0 = { x: 480, y: 24 }, Q1 = { x: 750, y: 120 }, Q2 = { x: 1020, y: 6 };
    const COL = ['#F28DB6', '#8FD3E8', '#FFD98A', '#B79CF0'];
    let g = '<path d="M-20 6 Q250 120 520 24" stroke="#9B3F86" stroke-width="3" fill="none"/><path d="M480 24 Q750 120 1020 6" stroke="#9B3F86" stroke-width="3" fill="none"/>';
    [[P0, P1, P2], [Q0, Q1, Q2]].forEach(function (s, si) {
      for (let i = 1; i < 9; i++) {
        const p = qpt(s[0], s[1], s[2], i / 9), c = COL[(i + si) % 4];
        g += '<g class="sc-sway" style="animation-delay:-' + n((i * 0.9 + si * 1.7) % 5) + 's"><polygon points="' + n(p.x - 17) + ',' + n(p.y) + ' ' + n(p.x + 17) + ',' + n(p.y) + ' ' + n(p.x) + ',' + n(p.y + 40) + '" fill="' + c + '"/></g>';
      }
    });
    return SKY(g);
  }

  /* ====================== 應用題島：故事書村 ====================== */
  function wpScene() {
    const PAPER = '#FFFDF4', PUR = '#8C73E0', BLU = '#4A74D0';
    const house = function (x, y, w, h, wall, roof) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + wall + '" stroke="#7B6BC4" stroke-width="3"/>' + poly((x - 8) + ',' + (y + 2) + ' ' + n(x + w / 2) + ',' + n(y - h * .62) + ' ' + (x + w + 8) + ',' + (y + 2), roof) +
        '<rect x="' + n(x + w * .38) + '" y="' + n(y + h * .42) + '" width="' + n(w * .24) + '" height="' + n(h * .58) + '" rx="3" fill="#9B86E8"/><rect x="' + n(x + w * .1) + '" y="' + n(y + h * .2) + '" width="' + n(w * .2) + '" height="' + n(h * .26) + '" rx="2" fill="#CFE0FF"/><rect x="' + n(x + w * .7) + '" y="' + n(y + h * .2) + '" width="' + n(w * .2) + '" height="' + n(h * .26) + '" rx="2" fill="#CFE0FF"/>';
    };
    const tag = function (x, y, s, rot) { return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + s + ')"><path d="M-34 -18 H24 L40 0 L24 18 H-34 Z" fill="#FFFDF4" stroke="#5B8FE0" stroke-width="4" stroke-dasharray="9 5"/><circle cx="28" cy="0" r="4" fill="#5B8FE0"/><path d="M-24 0 H10" stroke="#B7A8EE" stroke-width="5" stroke-linecap="round"/></g>'; };
    let g = '<path d="M-400 330 Q300 276 600 308 T1400 300 L1400 560 L-400 560 Z" fill="#CFC3F5"/>' +
      house(52, 252, 92, 68, '#FBF3E0', '#8C73E0') + house(168, 272, 72, 52, '#F1E9FF', '#5B8FE0') + house(786, 246, 104, 74, '#FBF3E0', '#E69AB0') + house(912, 268, 78, 54, '#F1E9FF', '#8C73E0') + house(706, 288, 58, 40, '#FBF3E0', '#5B8FE0') + house(-130, 262, 96, 62, '#FBF3E0', '#5B8FE0') + house(1042, 256, 100, 68, '#FBF3E0', '#E69AB0') +
      /* 故事道路 */
      '<path d="M500 424 C 420 384 600 354 520 322 C 470 302 540 288 504 270" stroke="#FFF6DE" stroke-width="46" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M500 424 C 420 384 600 354 520 322 C 470 302 540 288 504 270" stroke="#CFC3F5" stroke-width="3" fill="none" stroke-dasharray="10 14"/>';
    /* 打開的故事書（只有線條，沒有文字） */
    g += '<g transform="translate(0 -18)"><path d="M320 340 L320 420 C 380 404 450 404 500 428 C 550 404 620 404 680 420 L680 340" fill="' + BLU + '"/>' +
      '<path d="M500 346 C 450 324 380 324 332 340 L332 408 C 380 394 450 394 500 416 Z" fill="' + PAPER + '" stroke="' + BLU + '" stroke-width="4"/><path d="M500 346 C 550 324 620 324 668 340 L668 408 C 620 394 550 394 500 416 Z" fill="' + PAPER + '" stroke="' + BLU + '" stroke-width="4"/>' +
      '<g stroke="#B7A8EE" stroke-width="4" stroke-linecap="round"><path d="M356 354 C 390 346 430 348 474 360"/><path d="M356 370 C 390 362 430 364 474 376"/><path d="M356 386 C 390 378 420 380 450 390"/><path d="M526 360 C 570 348 610 346 644 354"/><path d="M526 376 C 570 364 610 362 644 370"/></g>' +
      '<g class="sc-float"><g transform="translate(560 286) rotate(10)"><rect x="-30" y="-38" width="60" height="76" rx="6" fill="' + PAPER + '" stroke="' + PUR + '" stroke-width="4"/><path d="M-18 -18 H18 M-18 -4 H18 M-18 10 H4" stroke="#B7A8EE" stroke-width="4" stroke-linecap="round"/></g></g></g>';
    /* 鉛筆 */
    g += '<g transform="translate(96 392) rotate(-24)"><rect x="-16" y="-10" width="18" height="20" rx="4" fill="#E69AB0"/><rect x="0" y="-10" width="14" height="20" fill="#BDB2E8"/><rect x="14" y="-10" width="110" height="20" fill="#F2C14E"/><polygon points="124,-10 160,0 124,10" fill="#F6DDB0"/><polygon points="150,-3.5 160,0 150,3.5" fill="#4A3F5C"/></g>';
    g += tag(250, 366, .9, -8) + tag(756, 372, .85, 7);
    return GROUND(g);
  }
  function wpSky() {
    const dots = function (x, y) { return '<circle cx="' + (x - 18) + '" cy="' + y + '" r="5" fill="#8C73E0"/><circle cx="' + x + '" cy="' + y + '" r="5" fill="#8C73E0"/><circle cx="' + (x + 18) + '" cy="' + y + '" r="5" fill="#8C73E0"/>'; };
    const bubble = function (x, y, w, h, tailLeft, fill, d) {
      const tx = tailLeft ? x + 26 : x + w - 26;
      return '<g class="sc-float" style="animation-delay:-' + d + 's"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + n(h * .36) + '" fill="' + fill + '" stroke="#5B8FE0" stroke-width="4"/><path d="M' + tx + ' ' + (y + h - 2) + ' l' + (tailLeft ? -12 : 12) + ' 24 l' + (tailLeft ? 30 : -30) + ' -24" fill="' + fill + '" stroke="#5B8FE0" stroke-width="4" stroke-linejoin="round"/><path d="M' + (tx - 14) + ' ' + (y + h - 4) + ' h30" stroke="' + fill + '" stroke-width="6"/>' + dots(x + w / 2, y + h / 2) + '</g>';
    };
    const tag = function (x, y, rot, d) { return '<g class="sc-float" style="animation-delay:-' + d + 's"><g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"><path d="M-34 -16 H22 L38 0 L22 16 H-34 Z" fill="#FFFDF4" stroke="#5B8FE0" stroke-width="4" stroke-dasharray="9 5"/><circle cx="26" cy="0" r="4" fill="#5B8FE0"/><path d="M-24 0 H8" stroke="#B7A8EE" stroke-width="5" stroke-linecap="round"/></g></g>'; };
    return SKY(bubble(40, 24, 150, 78, true, '#FFFDF4', 0) + bubble(790, 18, 170, 84, false, '#EDE7FD', 3) + bubble(430, 8, 124, 62, true, '#FFFDF4', 6) + tag(300, 96, -8, 2) + tag(676, 112, 8, 5));
  }

  /* ====================== 四則運算島：秩序神殿 ====================== */
  function sym(kind) {
    const s = 'stroke="#E8B63A" stroke-width="5" stroke-linecap="round" fill="none"';
    if (kind === '+') return '<path d="M-9 0 H9 M0 -9 V9" ' + s + '/>';
    if (kind === '-') return '<path d="M-9 0 H9" ' + s + '/>';
    if (kind === 'x') return '<path d="M-8 -8 L8 8 M8 -8 L-8 8" ' + s + '/>';
    return '<path d="M-9 0 H9" ' + s + '/><circle cx="0" cy="-8" r="2.6" fill="#E8B63A"/><circle cx="0" cy="8" r="2.6" fill="#E8B63A"/>';
  }
  function mixScene() {
    const STONE = '#F4F0E2', EDGE = '#C9C1A4', GOLD = '#E8B63A', GOLD2 = '#B88915', IND = '#2F3E9E';
    let g = '<defs><linearGradient id="scg-ray" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E8B63A" stop-opacity=".7"/><stop offset="1" stop-color="#E8B63A" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon points="500,76 300,-200 700,-200" fill="url(#scg-ray)"/>' +
      '<rect x="-600" y="364" width="2200" height="90" fill="#D9D2BC"/><g transform="translate(0 -40)">' +
      '<rect x="120" y="384" width="760" height="20" fill="#E9E4D2" stroke="' + EDGE + '" stroke-width="3"/><rect x="170" y="366" width="660" height="20" fill="#EFEADA" stroke="' + EDGE + '" stroke-width="3"/><rect x="214" y="348" width="572" height="20" fill="' + STONE + '" stroke="' + EDGE + '" stroke-width="3"/>';
    for (let i = 0; i < 6; i++) {
      const x = 246 + i * 96;
      g += '<rect x="' + x + '" y="190" width="46" height="158" fill="' + STONE + '" stroke="' + EDGE + '" stroke-width="3"/>' + line(x + 15, 196, x + 15, 342, EDGE, 3) + line(x + 31, 196, x + 31, 342, EDGE, 3) +
        '<rect x="' + (x - 6) + '" y="174" width="58" height="16" rx="3" fill="#EFEADA" stroke="' + EDGE + '" stroke-width="3"/><rect x="' + (x - 5) + '" y="340" width="56" height="10" rx="2" fill="#EFEADA" stroke="' + EDGE + '" stroke-width="3"/>';
    }
    g += '<rect x="216" y="146" width="568" height="30" fill="#EFEADA" stroke="' + EDGE + '" stroke-width="3"/>' + poly('204,148 500,70 796,148', STONE, 'stroke="' + GOLD2 + '" stroke-width="5" stroke-linejoin="round"') +
      '<circle cx="500" cy="124" r="14" fill="' + GOLD + '"/>' +
      /* 皇冠 */
      '<path d="M456 68 L466 30 L484 54 L500 22 L516 54 L534 30 L544 68 Z" fill="' + GOLD + '" stroke="' + GOLD2 + '" stroke-width="4" stroke-linejoin="round"/><circle cx="466" cy="28" r="5" fill="#fff"/><circle cx="500" cy="20" r="5" fill="#fff"/><circle cx="534" cy="28" r="5" fill="#fff"/></g>';
    [-170, -122, 1126, 1174].forEach(function (x) { g += '<g transform="translate(0 -40)"><rect x="' + x + '" y="214" width="40" height="134" fill="' + STONE + '" stroke="' + EDGE + '" stroke-width="3"/>' + line(x + 13, 220, x + 13, 342, EDGE, 3) + line(x + 27, 220, x + 27, 342, EDGE, 3) + '<rect x="' + (x - 6) + '" y="200" width="52" height="14" rx="3" fill="#EFEADA" stroke="' + EDGE + '" stroke-width="3"/></g>'; });
    /* 運算軌道：兩條鐵軌＋枕木，四個站牌（加、減、乘、除） */
    let ties = ''; for (let x = -560; x < 1560; x += 34) ties += line(x, 376, x + 10, 402, '#8C6A3A', 6);
    g += ties + '<rect x="-600" y="380" width="2200" height="6" fill="' + IND + '"/><rect x="-600" y="394" width="2200" height="6" fill="' + IND + '"/>';
    [['+', 120], ['-', 360], ['x', 640], ['/', 880], ['+', -150], ['x', 1150]].forEach(function (s) { g += '<g transform="translate(' + s[1] + ' 388)"><circle r="26" fill="' + IND + '" stroke="' + GOLD + '" stroke-width="5"/>' + sym(s[0]) + '</g>'; });
    return GROUND(g);
  }
  function mixSky() {
    const banner = function (x, a, b) {
      return '<g class="sc-sway" style="animation-delay:-' + n(x % 4) + 's"><path d="M' + (x - 34) + ' -6 H' + (x + 34) + ' V176 L' + x + ' 150 L' + (x - 34) + ' 176 Z" fill="#2F3E9E" stroke="#E8B63A" stroke-width="4" stroke-linejoin="round"/><g transform="translate(' + x + ' 42)">' + sym(a) + '</g><g transform="translate(' + x + ' 104)">' + sym(b) + '</g></g>';
    };
    /* 小圖章：括號、先乘除、後加減、由左到右（只用圓括號形狀，沒有中括號／大括號） */
    const stamp = function (x, kind) {
      let ic = '';
      const s = 'stroke="#E8B63A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"';
      if (kind === 'paren') ic = '<path d="M-7 -14 C-17 -5 -17 5 -7 14 M7 -14 C17 -5 17 5 7 14" ' + s + '/><circle cx="0" cy="0" r="3" fill="#E8B63A"/>';
      if (kind === 'md') ic = '<g transform="translate(-9 3) scale(.72)">' + sym('x') + '</g><g transform="translate(9 3) scale(.72)">' + sym('/') + '</g><circle cx="0" cy="-13" r="3.2" fill="#E8B63A"/>';
      if (kind === 'as') ic = '<g transform="translate(-9 3) scale(.72)">' + sym('+') + '</g><g transform="translate(9 3) scale(.72)">' + sym('-') + '</g><circle cx="-5" cy="-13" r="3.2" fill="#E8B63A"/><circle cx="5" cy="-13" r="3.2" fill="#E8B63A"/>';
      if (kind === 'lr') ic = '<path d="M-14 0 H14 M6 -8 L14 0 L6 8" ' + s + '/>';
      return '<g transform="translate(' + x + ' 96)"><circle r="28" fill="#2F3E9E" stroke="#E8B63A" stroke-width="4"/>' + ic + '</g>';
    };
    let motes = '';
    [[210, 130, 0], [330, 60, 4], [660, 150, 7], [780, 70, 2], [520, 30, 9], [900, 140, 5]].forEach(function (m) { motes += '<circle class="sc-mote" cx="' + m[0] + '" cy="' + m[1] + '" r="5" fill="#E8B63A" style="animation-delay:-' + m[2] + 's"/>'; });
    return SKY(banner(78, '+', '-') + banner(922, 'x', '/') + banner(-60, 'x', '/') + banner(1060, '+', '-') + '<path d="M300 96 H700" stroke="#E8B63A" stroke-width="3" stroke-dasharray="4 8"/>' + stamp(340, 'paren') + stamp(447, 'md') + stamp(553, 'as') + stamp(660, 'lr') + motes);
  }

  const BUILD = { add: [addSky, addScene], sub: [subSky, subScene], mul: [mulSky, mulScene], div: [divSky, divScene], wp: [wpSky, wpScene], mix: [mixSky, mixScene] };

  function html(key) {
    const k = KEYS.indexOf(key) >= 0 ? key : 'add';
    if (IMAGES && IMAGES[k]) return '<img class="sc-layer sc-img" src="' + IMAGES[k] + '" alt="" aria-hidden="true" draggable="false">';
    return BUILD[k][0]() + BUILD[k][1]();
  }
  /* 把場景畫進 #ig-scene（同一座島不重畫，避免動畫被重置） */
  function render(key) {
    const box = document.getElementById('ig-scene'); if (!box) return;
    const k = KEYS.indexOf(key) >= 0 ? key : 'add';
    if (box.dataset && box.dataset.scene === k && box.innerHTML) return;
    box.innerHTML = html(k);
    if (box.dataset) box.dataset.scene = k;
  }
  function useImages(map) { IMAGES = map || null; try { const box = document.getElementById('ig-scene'); if (box && box.dataset) { const k = box.dataset.scene; box.dataset.scene = ''; if (k) render(k); } } catch (e) { /* 測試環境 */ } }

  return { version: '1.0.0', keys: KEYS, html: html, render: render, useImages: useImages };
})();
