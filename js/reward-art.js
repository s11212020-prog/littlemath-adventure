/* ==========================================================================
   階段 9E-2：獎勵道具的原創美術與穿戴合成（RewardArt）
   - 只負責「畫」：不呼叫後端、不讀寫任何學生資料、不使用瀏覽器儲存、沒有外部圖檔／字型／CDN
   - 物品名稱、欄位、稀有度、星數門檻、二選一配對一律讀 js/rewards.js 的 REWARD_CATALOG（單一來源，不另存一份）；
     這裡只放「畫法」「說明文字」「髮色色票」。
   - 稀有度用「底盤形狀＋珍珠數＋文字」表示，不只靠顏色；所有圖案都是原創 SVG
   - 載入順序：rewards.js 之後（需要 crew.js、sea-art.js 已載入）；index.html 最後面依序 rewards.js → reward-art.js → reward-look.js → cabin-net.js → cabin.js
   ========================================================================== */
const RewardArt = (function () {
  'use strict';

  /* ---------- 1. 目錄（全部由 REWARD_CATALOG 導出） ---------- */
  const CAT = REWARD_CATALOG;
  const PEARLS = { common: 1, uncommon: 2, legendary: 3, starter: 0 };
  const RARITY = {
    common: { label: CAT.rarity_labels.common, pearls: 1 }, uncommon: { label: CAT.rarity_labels.uncommon, pearls: 2 },
    legendary: { label: CAT.rarity_labels.legendary, pearls: 3 }, starter: { label: '起始', pearls: 0 }
  };
  /* 裝備欄位（順序固定）：tab 是「點一欄只看這一欄」用的類別 */
  const SLOT_NAMES = { badge1: '徽章 1', badge2: '徽章 2', head: '頭上', hand: '手上', lifebuoy: '救生圈', flag: '船旗', figurehead: '船首像', ship: '船身' };
  const SLOTS = Object.keys(CAT.slots).map(function (k) {
    const d = CAT.slots[k], o = { k: k, name: SLOT_NAMES[k] || k, tab: d.type };
    if (d.min_stars) o.min = d.min_stars; if (d.fixed) o.fixed = true; return o;
  });
  const ITEMS = Object.keys(CAT.items).map(function (id) {
    const it = CAT.items[id], t = it.tier ? CAT.tiers.filter(function (x) { return x.id === it.tier; })[0] : null;
    const o = { id: id, name: it.name, slot: it.type, rarity: it.starter ? 'starter' : it.rarity, starter: !!it.starter };
    if (t) { o.tier = t.id; o.stars = t.stars; o.pair = t.candidates.filter(function (c) { return c !== id; })[0]; }
    return o;
  });
  const BY_ID = {}; ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
  const TIERS = CAT.tiers.map(function (t) { return { id: t.id, stars: t.stars, rarity: t.rarity, items: t.candidates.slice() }; });
  const ISLANDS = [{ k: 'add', name: '加法島' }, { k: 'sub', name: '減法島' }, { k: 'mul', name: '乘法島' }, { k: 'div', name: '除法島' }, { k: 'wp', name: '應用題島' }, { k: 'mix', name: '四則運算島' }];

  /* ---------- 2. 髮色色票（id 必須和 REWARD_CATALOG.appearance.hair_color 相同；測試會比對） ---------- */
  const HAIR_PALETTE = [
    { k: 'ink', name: '墨藍黑', c: '#2C2A55' }, { k: 'cocoa', name: '可可棕', c: '#6B4A2E' },
    { k: 'caramel', name: '焦糖橘', c: '#C9742F' }, { k: 'honey', name: '蜂蜜金', c: '#E8B84A' },
    { k: 'coral', name: '珊瑚紅', c: '#E2574C' }, { k: 'mint', name: '薄荷綠', c: '#2FA97F' },
    { k: 'ocean', name: '海洋藍', c: '#2F8FD0' }, { k: 'wisteria', name: '紫藤', c: '#8B6FE8' }
  ];
  const HAIR_BY_ID = {}; HAIR_PALETTE.forEach(function (h) { HAIR_BY_ID[h.k] = h; });

  /* ---------- 3. 單件道具的原創圖（64×64，物品中心約 (32,32)） ---------- */
  function starPts(cx, cy, R, r, n, rot) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = (rot || -90) * Math.PI / 180 + i * Math.PI / n, d = i % 2 ? r : R; pts.push((cx + d * Math.cos(a)).toFixed(1) + ' ' + (cy + d * Math.sin(a)).toFixed(1)); }
    return 'M' + pts.join('L') + 'Z';
  }
  function sparkle(x, y, s) {
    return '<path class="it-sp" d="M' + x + ' ' + (y - s) + 'Q' + x + ' ' + y + ' ' + (x + s) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + s) + 'Q' + x + ' ' + y + ' ' + (x - s) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - s) + 'Z"/>';
  }
  function wedge(cx, cy, R, r, a0, a1) {
    const p = function (rad, a) { return (cx + rad * Math.cos(a)).toFixed(2) + ' ' + (cy + rad * Math.sin(a)).toFixed(2); };
    return 'M' + p(R, a0) + 'A' + R + ' ' + R + ' 0 0 1 ' + p(R, a1) + 'L' + p(r, a1) + 'A' + r + ' ' + r + ' 0 0 0 ' + p(r, a0) + 'Z';
  }
  const ANN = 'M8 32a24 24 0 1 0 48 0a24 24 0 1 0-48 0ZM21 32a11 11 0 1 0 22 0a11 11 0 1 0-22 0Z';
  function ringBase(fillA, fillB, sectors) {
    let s = '<path class="it-o ' + fillA + '" fill-rule="evenodd" d="' + ANN + '"/>';
    for (let i = 0; i < sectors; i += 2) { s += '<path class="' + fillB + '" d="' + wedge(32, 32, 24, 11, i * 2 * Math.PI / sectors, (i + 1) * 2 * Math.PI / sectors) + '"/>'; }
    return s + '<path class="it-line" d="' + ANN + '" fill-rule="evenodd"/>';
  }
  const ART = {
    /* --- 徽章（普通） --- */
    badge_starfish: function () {
      let dots = ''; for (let i = 0; i < 5; i++) { const a = (-90 + i * 72) * Math.PI / 180; dots += '<circle class="f-cream" cx="' + (32 + 14 * Math.cos(a)).toFixed(1) + '" cy="' + (32 + 14 * Math.sin(a)).toFixed(1) + '" r="1.9"/><circle class="f-cream" cx="' + (32 + 8 * Math.cos(a)).toFixed(1) + '" cy="' + (32 + 8 * Math.sin(a)).toFixed(1) + '" r="1.5"/>'; }
      return '<path class="it-o f-coral it-fat" d="' + starPts(32, 33, 25, 12, 5) + '"/>' + dots + '<circle class="f-gold it-o" cx="32" cy="33" r="3.6"/>';
    },
    badge_shell: function () {
      let ribs = ''; [-34, -17, 0, 17, 34].forEach(function (d) { const a = (d - 90) * Math.PI / 180; ribs += '<path class="it-line it-thin" d="M32 52L' + (32 + 30 * Math.cos(a)).toFixed(1) + ' ' + (52 + 30 * Math.sin(a)).toFixed(1) + '"/>'; });
      return '<path class="it-o f-pink" d="M32 54L9 33Q8 12 32 9Q56 12 55 33Z"/>' + ribs + '<rect class="it-o f-cream" x="24" y="50" width="16" height="8" rx="4"/>' + '<path class="it-hi" d="M17 28Q19 18 27 14"/>';
    },
    /* --- 頭飾：帽沿線在 y=42，戴上時對齊額頭 --- */
    head_sailor_cap: function () {
      return '<path class="it-o f-navy" d="M12 42Q11 14 32 14Q53 14 52 42Z"/><path class="it-o f-white" d="M8 40H56a4.5 4.5 0 0 1 0 9H8a4.5 4.5 0 0 1 0-9Z"/><path class="it-line it-coral-s" d="M14 44.5H50"/>' +
        '<circle class="it-o f-gold" cx="32" cy="22.5" r="2.8"/><path class="it-line" style="stroke:#FFD166;stroke-width:2.2" d="M32 25.5V34M27.5 30.5H36.5M27 35Q32 39 37 35"/><path class="it-hi" d="M19 27Q22 19 29 18"/>';
    },
    head_straw_hat: function () {
      return '<ellipse class="it-o f-straw" cx="32" cy="41" rx="29" ry="8.5"/><path class="it-o f-straw" d="M17 41Q16 15 32 15Q48 15 47 41Q32 47 17 41Z"/><path class="it-o f-red" d="M17.5 36Q32 42 46.5 36L47 41Q32 47 17 41Z"/>' +
        '<path class="it-line it-thin" d="M22 22Q32 18 42 22M20 29Q32 24 44 29M6 41Q32 50 58 41"/>';
    },
    /* --- 手持（非凡）：握點約在中心 --- */
    hand_telescope: function () {
      return '<g transform="rotate(-38 32 32)"><rect class="it-o f-navy" x="5" y="25.5" width="13" height="13" rx="4"/><rect class="it-o f-gold" x="16" y="23.5" width="17" height="17" rx="4"/><rect class="it-o f-mint" x="31" y="21.5" width="14" height="21" rx="4"/>' +
        '<path class="it-o f-navy" d="M43 20L58 15V49L43 44Z"/><ellipse class="it-o f-glass" cx="58" cy="32" rx="3.2" ry="17"/><path class="it-line it-white-s it-thin" d="M21 29H29M35 27H40"/></g>';
    },
    hand_compass: function () {
      let ticks = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r1 = i % 3 === 0 ? 14 : 16.5; ticks += '<path class="it-line it-thin" d="M' + (32 + r1 * Math.cos(a)).toFixed(1) + ' ' + (35 + r1 * Math.sin(a)).toFixed(1) + 'L' + (32 + 19 * Math.cos(a)).toFixed(1) + ' ' + (35 + 19 * Math.sin(a)).toFixed(1) + '"/>'; }
      return '<rect class="it-o f-gold2" x="27.5" y="4" width="9" height="9" rx="4.5"/><circle class="it-o f-gold2" cx="32" cy="35" r="26"/><circle class="it-o f-cream" cx="32" cy="35" r="20.5"/>' + ticks +
        '<path class="it-o f-coral" d="M32 19L37 35L32 33L27 35Z"/><path class="it-o f-navy" d="M32 51L27 35L32 37L37 35Z"/><circle class="it-o f-gold" cx="32" cy="35" r="2.8"/>';
    },
    /* --- 救生圈 --- */
    ring_stripe: function () { return ringBase('f-white', 'f-coral', 8); },
    ring_coral: function () {
      let nubs = ''; [45, 135, 225, 315].forEach(function (d) { const r = d * Math.PI / 180; nubs += '<circle class="it-o f-red" cx="' + (32 + 24.5 * Math.cos(r)).toFixed(1) + '" cy="' + (32 + 24.5 * Math.sin(r)).toFixed(1) + '" r="4.6"/>'; });
      return nubs + ringBase('f-pink', 'f-cream', 12) + [45, 135, 225, 315].map(function (d) { const r = d * Math.PI / 180; return '<circle class="f-cream" cx="' + (32 + 24.5 * Math.cos(r) - 1.2).toFixed(1) + '" cy="' + (32 + 24.5 * Math.sin(r) - 1.2).toFixed(1) + '" r="1.3"/>'; }).join('');
    },
    ring_starsea: function () {
      let st = ''; for (let i = 0; i < 5; i++) { const a = (-90 + i * 72) * Math.PI / 180; st += '<path class="it-s f-gold" d="' + starPts(32 + 17.5 * Math.cos(a), 32 + 17.5 * Math.sin(a), 5.4, 2.4, 5) + '"/>'; }
      return '<path class="it-o f-night" fill-rule="evenodd" d="' + ANN + '"/>' + st + '<path class="it-gold-ring" fill-rule="evenodd" d="' + ANN + '"/>';
    },
    ring_aurora: function () {
      const hole = 'M21 32a11 11 0 1 0 22 0a11 11 0 1 0-22 0Z', ann = function (R, r) { return 'M' + (32 - R) + ' 32a' + R + ' ' + R + ' 0 1 0 ' + 2 * R + ' 0a' + R + ' ' + R + ' 0 1 0-' + 2 * R + ' 0ZM' + (32 - r) + ' 32a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0-' + 2 * r + ' 0Z'; };
      return '<path class="it-o f-teal" fill-rule="evenodd" d="' + wavyPath(32, 32, 23.8, 2.3, 12) + hole + '"/>' +
        '<path class="f-violet" fill-rule="evenodd" d="' + ann(19.6, 15.6) + '"/><path class="f-pink" fill-rule="evenodd" d="' + ann(15.6, 11) + '"/>' +
        '<path class="it-line it-thin" d="' + ann(19.6, 19.6).split('Z')[0] + 'Z"/><path class="it-line it-thin" d="' + ann(15.6, 15.6).split('Z')[0] + 'Z"/>' +
        '<path class="it-line" d="' + hole + '"/><path class="it-wavy" d="M13 20Q17 14 24 12"/>';
    },
    /* --- 船旗 --- */
    flag_default: function () {
      return '<path class="it-o it-pole" d="M14 6V60"/><path class="it-o f-gold" d="M14 9L50 20L14 31Z"/>';
    },
    flag_wave: function () {
      return '<path class="it-o it-pole" d="M12 6V60"/><path class="it-o f-teal" d="M12 9Q24 3 36 9T60 9V33Q48 39 36 33T12 33Z"/>' +
        '<path class="it-line it-white-s" d="M14 17Q24 12 34 17T58 17M14 25Q24 20 34 25T58 25"/>';
    },
    /* --- 傳奇 --- */
    head_crown: function () {
      return '<path class="it-o f-gold" d="M9 45L6 17L21 29L32 10L43 29L58 17L55 45Z"/><rect class="it-o f-gold2" x="8" y="41" width="48" height="9" rx="3"/>' +
        '<circle class="it-o f-coral" cx="6" cy="16" r="3.8"/><circle class="it-o f-teal" cx="32" cy="9" r="4"/><circle class="it-o f-coral" cx="58" cy="16" r="3.8"/>' +
        '<path class="it-s f-white" d="' + starPts(32, 32, 7.5, 3.2, 5) + '"/><circle class="it-o f-red" cx="18" cy="45.5" r="2.4"/><circle class="it-o f-teal" cx="32" cy="45.5" r="2.4"/><circle class="it-o f-red" cx="46" cy="45.5" r="2.4"/><path class="it-hi" d="M13 36L11 24"/>';
    },
    figurehead_star: function () {
      return '<path class="it-o f-woodd" d="M10 60Q10 40 22 33Q28 30 29 24L36 28Q34 38 26 44Q20 48 22 60Z"/>' +
        '<path class="it-o f-gold it-fat" d="' + starPts(40, 24, 21, 10.5, 5) + '"/><ellipse class="f-ink" cx="35.5" cy="23" rx="1.9" ry="2.6"/><ellipse class="f-ink" cx="44.5" cy="23" rx="1.9" ry="2.6"/><path class="it-line" d="M36 29Q40 33 44 29"/>' +
        '';
    },
    ship_basic: function () {
      return '<g transform="translate(-4 -3)">' + BoatArt.sail().replace('class="bt-sail"', 'class="it-boatpart" x="12" y="2" width="40" height="34"').replace(/ia-o/g, 'it-o').replace(/ia-gold/g, 'f-gold').replace(/ia-white/g, 'f-white').replace(/ia-coral/g, 'f-coral') +
        BoatArt.hull().replace('class="bt-hull"', 'class="it-boatpart" x="4" y="32" width="56" height="23"').replace(/ia-woodd/g, 'f-woodd').replace(/ia-wood/g, 'f-wood').replace(/ia-cream/g, 'f-cream').replace(/ia-o/g, 'it-o') + '</g>';
    }
  };
  /* 稀有度「加料」：同一套規則套在所有道具上 */
  function extras(it) {
    if (it.rarity === 'uncommon') return sparkle(54, 11, 6.5);
    if (it.rarity === 'legendary') return sparkle(55, 10, 8) + sparkle(8, 52, 5.5) + '<path class="it-shine" d="M14 14L22 6"/>';
    return '';
  }
  function artInner(id) { const f = ART[id]; return f ? f() : ''; }

  /* ---------- 4. 底盤（稀有度 = 形狀＋珍珠數＋文字，不只靠顏色） ---------- */
  function wavyPath(cx, cy, r, amp, n) {
    const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120 * 2 * Math.PI, d = r + amp * Math.cos(n * t); pts.push((cx + d * Math.cos(t)).toFixed(1) + ' ' + (cy + d * Math.sin(t)).toFixed(1)); }
    return 'M' + pts.join('L') + 'Z';
  }
  function burstPath(cx, cy, R, r, n) { return starPts(cx, cy, R, r, n, -90 + 180 / n); }
  function plate(rar) {
    if (rar === 'common') return '<circle class="pl pl-c" cx="40" cy="40" r="36"/>';
    if (rar === 'uncommon') return '<path class="pl pl-u" d="' + wavyPath(40, 40, 34.5, 3.2, 12) + '"/><circle class="pl-in pl-in-u" cx="40" cy="40" r="29"/>';
    if (rar === 'legendary') return '<path class="pl pl-l" d="' + burstPath(40, 40, 37.5, 34, 14) + '"/><circle class="pl-in pl-in-l" cx="40" cy="40" r="30"/>';
    return '<circle class="pl pl-s" cx="40" cy="40" r="35"/>';
  }
  function pearls(n) {
    if (!n) return '';
    const xs = n === 1 ? [40] : n === 2 ? [35, 45] : [30, 40, 50];
    return xs.map(function (x) { return '<circle class="pearl" cx="' + x + '" cy="74" r="3.7"/><circle class="pearl-hi" cx="' + (x - 1.1) + '" cy="72.8" r="1"/>'; }).join('');
  }
  /** 道具圖示（80×80；含底盤與珍珠）。opt.size 像素；opt.plain=true 不畫底盤 */
  function icon(id, opt) {
    opt = opt || {};
    const it = BY_ID[id]; if (!it) return '';
    const size = opt.size || 96;
    const label = opt.label === false ? ' aria-hidden="true"' : ' role="img" aria-label="' + (it.name + '，' + RARITY[it.rarity].label) + '"';
    return '<svg class="it it--' + it.rarity + '" viewBox="0 0 80 80" width="' + size + '" height="' + size + '" focusable="false"' + label + '>' +
      (opt.plain ? '' : plate(it.rarity)) + '<g transform="translate(40 40) scale(' + (opt.plain ? 1.1 : 0.78) + ') translate(-32 -32)">' + artInner(id) + extras(it) + '</g>' + (opt.plain ? '' : pearls(RARITY[it.rarity].pearls)) + '</svg>';
  }
  /** 只有物品本身（64×64，無底盤）：用在穿戴、小圖 */
  function art(id, size) {
    const it = BY_ID[id];
    return '<svg class="it it--bare" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' + artInner(id) + extras(it) + '</svg>';
  }
  function pearlRow(rar, size) {
    const n = RARITY[rar].pearls; let s = '';
    for (let i = 0; i < n; i++) s += '<svg class="pearl-ico" viewBox="0 0 12 12" width="' + (size || 12) + '" height="' + (size || 12) + '" aria-hidden="true"><circle class="pearl" cx="6" cy="6" r="4.6"/><circle class="pearl-hi" cx="4.7" cy="4.6" r="1.2"/></svg>';
    return s;
  }
  function rarityChip(rar) {
    return '<span class="rar rar--' + rar + '">' + pearlRow(rar, 12) + '<span>' + RARITY[rar].label + '</span></span>';
  }

  /* ---------- 5. 穿戴合成 ---------- */
  const DEFAULT_EQUIP = {}; Object.keys(CAT.slots).forEach(function (k) { DEFAULT_EQUIP[k] = CAT.slots[k].default || null; });
  function eq(e) { return Object.assign({}, DEFAULT_EQUIP, e || {}); }

  function wornParts(code, equip) {
    const a = AvatarKit.parse(code) || AvatarKit.defaultsFor(1), e = eq(equip), o = {};
    if (e.head) {
      o.noHat = true;
      o.head = '<g transform="translate(60 46) scale(' + (e.head === 'head_crown' ? 1.12 : 1.18) + ') translate(-32 -42)">' + artInner(e.head) + extras(BY_ID[e.head]) + '</g>';
    }
    if (e.hand) {
      const h = AvatarKit.HAND_ANCHOR[a.c], it = BY_ID[e.hand];
      o.noItem = true;
      o.hand = '<g transform="translate(' + h[0] + ' ' + h[1] + ') rotate(' + h[2] + ') scale(' + (e.hand === 'hand_compass' ? 0.62 : 0.72) + ') translate(-32 -' + (e.hand === 'hand_compass' ? 38 : 32) + ')">' + artInner(e.hand) + extras(it) + '</g>' +
        '<circle class="cw-ink cw-skin" cx="' + h[0] + '" cy="' + h[1] + '" r="6.5"/>';
    }
    let bd = '';
    if (e.badge1) bd += '<g transform="translate(69 105) scale(.36) translate(-32 -32)"><circle class="it-o f-white" cx="32" cy="32" r="29" style="stroke-width:5"/>' + artInner(e.badge1) + '</g>';
    if (e.badge2) bd += '<g transform="translate(69 126) scale(.36) translate(-32 -32)"><circle class="it-o f-white" cx="32" cy="32" r="29" style="stroke-width:5"/>' + artInner(e.badge2) + '</g>';
    o.badges = bd;
    return o;
  }
  /** 全身（或半身）角色，含裝備、髮色、制服色。app = {hair: '#hex'|null, uniform: index|null} */
  function crewSVG(code, equip, opt) {
    opt = opt || {};
    const a = AvatarKit.parse(code) || AvatarKit.defaultsFor(1), o = wornParts(code, equip);
    if (opt.noHat) { o.noHat = true; o.head = ''; }
    o.view = opt.view; o.label = opt.label === undefined ? false : opt.label; o.className = opt.className;
    if (opt.hair) o.hair = opt.hair;
    if (opt.uniform != null) o.uniform = AvatarKit.COLORS[opt.uniform];
    return AvatarKit.svg(a, o);
  }
  function bustHTML(code, equip, px, opt) {
    return crewSVG(code, equip, Object.assign({ view: 'bust' }, opt || {})).replace('<svg ', '<svg width="' + px + '" height="' + Math.round(px * 104 / 96) + '" ');
  }

  /* 小船內容：帆（含換掉的船旗）→ 船員半身 → 船身（含救生圈、船首像）。
     結構和 sea-map.js 原本的小船相同（.bt-sail／.sm-boat__crew／.bt-hull 的定位來自 css/map.css），
     換船旗、救生圈、船首像只是在同樣大小的框上多疊一層 SVG（.rw-over，不接收點擊）。 */
  function boatInner(code, equip, crewPx, opt) {
    opt = opt || {};
    const e = eq(equip);
    const flagOver = e.flag && e.flag !== 'flag_default'
      ? '<svg class="bt-sail rw-over" viewBox="0 0 72 60" aria-hidden="true" focusable="false"><g transform="translate(36 6.5) scale(.46) translate(-12 -9)">' + artInner(e.flag) + extras(BY_ID[e.flag]) + '</g></svg>' : '';
    const ring = e.lifebuoy ? '<g transform="translate(51 15.6) scale(.34) translate(-32 -32)">' + artInner(e.lifebuoy) + '</g>' : '';
    const fig = e.figurehead ? '<g transform="translate(57.5 22.5) scale(.42) translate(-12 -58)">' + artInner(e.figurehead) + '</g>' : '';
    return BoatArt.sail({ noFlag: !!(e.flag && e.flag !== 'flag_default') }) + flagOver +
      '<span class="sm-boat__crew">' + bustHTML(code, equip, crewPx, opt.crew) + '</span>' +
      BoatArt.hull() + '<svg class="bt-hull rw-over" viewBox="0 0 72 30" aria-hidden="true" focusable="false">' + ring + fig + '</svg>';
  }
  /* 船員小屋展示間用的小船（外面包一層，大小由 CSS 變數 --boat-w 決定） */
  function boatHTML(code, equip, widthPx, opt) {
    const css = widthPx === 'css', w = css ? 0 : (widthPx || 168);
    return '<div class="cb-boat"' + (css ? '' : ' style="--boat-w:' + w + 'px"') + '>' + boatInner(code, equip, css ? 80 : Math.round(w * 0.5), opt) + '</div>';
  }

  return { RARITY: RARITY, SLOTS: SLOTS, ITEMS: ITEMS, BY_ID: BY_ID, TIERS: TIERS, ISLANDS: ISLANDS, HAIR_PALETTE: HAIR_PALETTE, DEFAULT_EQUIP: DEFAULT_EQUIP,
    icon: icon, art: art, pearlRow: pearlRow, rarityChip: rarityChip, crewSVG: crewSVG, bustHTML: bustHTML, boatHTML: boatHTML, boatInner: boatInner, eq: eq, HAIR_BY_ID: HAIR_BY_ID, hairHex: function (id) { return HAIR_BY_ID[id] ? HAIR_BY_ID[id].c : null; } };
})();
