/* ==========================================================================
   《小小算術家：六島大冒險》階段 6：學習動畫的原創道具（SVG）＋ 補充圖示
   - 所有圖都是原創手繪風 SVG（圓潤、墨藍描邊、琺瑯色塊），不使用 emoji、不使用其他遊戲的素材。
   - 以 Props.xxx() 回傳 SVG 字串；寬高由 CSS 控制（.th-prop），日後可用 Props.useImages({ frog: 'assets/props/frog.svg' }) 換成精緻圖檔。
   - 補充的圖示（eye、steps、spark、think、flag）加進 UIKit.ICONS，沿用同一套圖示規則。
   只定義全域物件 Props；不讀寫學生資料。
   ========================================================================== */
const Props = (function () {
  'use strict';
  const INK = '#17324D';
  const sw = 'stroke="' + INK + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  const svg = function (vb, inner, cls) { return '<svg class="th-prop ' + (cls || '') + '" viewBox="' + vb + '" aria-hidden="true" focusable="false">' + inner + '</svg>'; };
  let images = {};

  const ART = {
    /* 青蛙：圓圓的綠身體、兩顆凸眼、淺色肚子 */
    frog: function () {
      return svg('0 0 64 56',
        '<ellipse cx="32" cy="36" rx="25" ry="16" fill="#47C98B" ' + sw + '/>' +
        '<ellipse cx="32" cy="41" rx="14" ry="9" fill="#D9F7E5"/>' +
        '<circle cx="20" cy="18" r="9" fill="#47C98B" ' + sw + '/><circle cx="44" cy="18" r="9" fill="#47C98B" ' + sw + '/>' +
        '<circle cx="20" cy="18" r="4.5" fill="#fff"/><circle cx="44" cy="18" r="4.5" fill="#fff"/><circle cx="21" cy="19" r="2.4" fill="' + INK + '"/><circle cx="45" cy="19" r="2.4" fill="' + INK + '"/>' +
        '<path d="M22 33q10 7 20 0" fill="none" ' + sw + '/>' +
        '<path d="M9 46q-4 4-1 7h8M55 46q4 4 1 7h-8" fill="#2FA86F" ' + sw + '/>', 'th-frog');
    },
    /* 池塘：水面＋兩片荷葉 */
    pond: function () {
      return svg('0 0 300 90',
        '<ellipse cx="150" cy="52" rx="146" ry="36" fill="#5CC8E6" ' + sw + '/>' +
        '<ellipse cx="150" cy="56" rx="118" ry="24" fill="#8BDAF0" opacity=".7"/>' +
        '<path d="M60 52a22 9 0 1 0 44 0 22 9 0 0 0-44 0zM196 58a24 9 0 1 0 48 0 24 9 0 0 0-48 0z" fill="#47C98B" ' + sw + '/>' +
        '<path d="M70 44q8 4 16 0M210 50q9 4 18 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>', 'th-pond-art');
    },
    /* 玩具：積木、小車、皮球（各一種顏色，也各有不同形狀，不只靠顏色分辨） */
    toyBlock: function () {
      return svg('0 0 56 56', '<rect x="8" y="10" width="40" height="38" rx="7" fill="#FF7A59" ' + sw + '/><path d="M8 24h40" fill="none" ' + sw + '/>' +
        '<path d="m28 28 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#FFD166" stroke="' + INK + '" stroke-width="2"/>', 'th-toy');
    },
    toyCar: function () {
      return svg('0 0 64 48', '<path d="M5 30l6-12q2-4 7-4h22q5 0 8 4l8 8q4 1 4 6v2H5z" fill="#47C0D8" ' + sw + '/>' +
        '<path d="M17 18h11v9H13zM32 18h9l6 9H32z" fill="#D9F7F5" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<circle cx="18" cy="38" r="7" fill="' + INK + '"/><circle cx="46" cy="38" r="7" fill="' + INK + '"/><circle cx="18" cy="38" r="2.6" fill="#FFD166"/><circle cx="46" cy="38" r="2.6" fill="#FFD166"/>', 'th-toy');
    },
    toyBall: function () {
      return svg('0 0 56 56', '<circle cx="28" cy="28" r="20" fill="#FFD166" ' + sw + '/><path d="M10 22q18 8 36 0M10 34q18-8 36 0" fill="none" stroke="#FF7A59" stroke-width="5" stroke-linecap="round"/><circle cx="28" cy="28" r="20" fill="none" ' + sw + '/>', 'th-toy');
    },
    /* 木箱 */
    crate: function () {
      return svg('0 0 120 100', '<path d="M8 30h104v62H8z" fill="#E2AA6F" ' + sw + '/><path d="M8 30h104v14H8zM8 60h104M8 76h104" fill="#F2C894" ' + sw + '/>' +
        '<path d="M8 30 22 8h76l14 22" fill="#F2C894" ' + sw + '/><path d="M26 44l22 16M94 44 72 60" fill="none" ' + sw + '/><circle cx="60" cy="66" r="5" fill="#A8703F" stroke="' + INK + '" stroke-width="2.5"/>', 'th-crate-art');
    },
    /* 花盆（有一條橫邊）與盆裡長出的三顆種子苗 */
    pot: function () {
      return svg('0 0 72 64', '<path d="M12 22h48l-6 38q-1 3-4 3H22q-3 0-4-3z" fill="#E98A4B" ' + sw + '/><rect x="8" y="14" width="56" height="12" rx="5" fill="#F2A369" ' + sw + '/><path d="M16 12q20-6 40 0" fill="#7A4B2A" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>', 'th-pot');
    },
    seeds: function () {
      const one = function (x) { return '<g transform="translate(' + x + ' 0)"><path d="M0 38V22" fill="none" stroke="#2FA86F" stroke-width="4" stroke-linecap="round"/><path d="M0 24q-12-2-12-12 10-1 12 12zM0 24q12-2 12-12-10-1-12 12z" fill="#7BC74D" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/></g>'; };
      return svg('0 0 72 44', one(14) + one(36) + one(58), 'th-seeds');
    },
    /* 糖果：橢圓糖＋兩端蝴蝶結紙，color 可換 */
    candy: function (color) {
      color = color || '#FF7AA2';
      return svg('0 0 48 32', '<path d="M8 16 1 8v16zM40 16l7-8v16z" fill="' + color + '" ' + 'stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="24" cy="16" rx="15" ry="11" fill="' + color + '" ' + sw + '/><path d="M16 14q6-5 12-3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/><path d="M30 10q3 7 0 14" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>', 'th-candy');
    },
    /* 盤子 */
    plate: function () {
      return svg('0 0 120 40', '<ellipse cx="60" cy="22" rx="56" ry="15" fill="#fff" ' + sw + '/><ellipse cx="60" cy="21" rx="38" ry="8" fill="#E8F3F7" stroke="#BFD3DF" stroke-width="2"/>', 'th-plate-art');
    },
    /* 神殿柱（四則運算島背景） */
    column: function () {
      return svg('0 0 44 120', '<path d="M4 6h36v10H4z" fill="#F3E3B3" ' + sw + '/><path d="M9 16h26v80H9z" fill="#F7EBC4" ' + sw + '/><path d="M18 20v72M26 20v72" fill="none" stroke="#E2D09A" stroke-width="3"/><path d="M2 96h40v14H2z" fill="#F3E3B3" ' + sw + '/>', 'th-column');
    }
  };

  const api = {
    version: '1.0.0', ART: ART,
    /* 日後提供精緻圖檔：Props.useImages({ frog: 'assets/props/frog.svg' })；名稱不變，不必改動畫程式 */
    useImages: function (map) { images = Object.assign({}, map || {}); },
    html: function (name, arg) {
      if (images[name]) return '<img class="th-prop th-img" src="' + images[name] + '" alt="" aria-hidden="true">';
      const f = ART[name]; return f ? f(arg) : '';
    }
  };
  Object.keys(ART).forEach(function (k) { api[k] = function (a) { return api.html(k, a); }; });

  /* ---------- 補充圖示（加進 UIKit.ICONS，viewBox 48×48，用法同其他圖示） ---------- */
  if (typeof UIKit !== 'undefined' && UIKit.ICONS) {
    Object.assign(UIKit.ICONS, {
      eye:   '<path class="c-surface" d="M3 24q9-15 21-15t21 15q-9 15-21 15T3 24z"/><circle class="c-sea" cx="24" cy="24" r="8"/><circle class="c-ink" cx="24" cy="24" r="3.6"/><circle class="c-white" cx="26.2" cy="21.8" r="1.4" stroke-width="0"/>',
      steps: '<path class="c-wood" d="M12 6v36M36 6v36" stroke-width="3"/><path class="c-sun" d="M12 14h24M12 24h24M12 34h24" stroke-width="4.5"/><path class="c-coral" d="m30 18 6 6-6 6" stroke-width="0" fill="none"/>',
      spark: '<path class="c-sun" d="m24 4 4.6 14.4L43 24l-14.4 5.6L24 44l-4.6-14.4L5 24l14.4-5.6z"/><path class="ns c-white-s" d="M20 16l2-3"/>',
      think: '<circle class="c-surface" cx="24" cy="24" r="19"/><path class="ns" stroke-width="4" d="M17 19q7-8 14 0c0 5-7 5-7 10"/><circle class="c-ink" cx="24" cy="36" r="2.2"/>',
      flag:  '<path class="ns" stroke-width="4" d="M12 6v38"/><path class="c-coral" d="M12 8h26l-6 9 6 9H12z"/>'
    });
  }
  return api;
})();
