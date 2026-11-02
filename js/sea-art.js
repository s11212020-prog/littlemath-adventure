/* 階段 5：海圖插圖（全部是原創手繪風 SVG，沒有使用任何其他遊戲的素材）
   - IslandArt.svg('add'|'sub'|'mul'|'div'|'wp'|'mix')：六座島各自的外形與地標
   - BoatArt.sail() / BoatArt.hull()：小船（9E-2：sail({ noFlag: true }) 可不畫預設船旗，給換船旗的裝備用；沒傳參數時輸出不變）
   - 小船（船員頭像由 AvatarKit.bustHTML 疊在中間）
   模組化：日後有了精修過的圖，把 IslandArt.useImages 設成 true，
   就會改讀 assets/islands/<key>.svg（或 .webp／.png，改 IslandArt.ext 即可），不必動地圖程式。
   顏色全部由 css/map.css 的 .ia-* 類別決定，這裡只管形狀。 */
const IslandArt = (function () {
  const FOAM = '<ellipse class="ia-foam" cx="120" cy="148" rx="114" ry="16"/><ellipse class="ia-foam ia-foam--in" cx="120" cy="147" rx="98" ry="10"/>';
  const wrap = function (key, label, body) {
    return '<svg class="ia-svg ia-svg--' + key + '" viewBox="0 0 240 170" role="img" aria-label="' + label + '" focusable="false">' + body + '</svg>';
  };

  /* 加法島：兩塊小島被木橋接在一起；棕櫚樹＋水果箱＋「+」路牌 */
  const add = FOAM +
    '<path class="ia-sand ia-o" d="M8 124Q10 148 62 150Q112 150 120 128Q112 108 62 107Q12 108 8 124Z"/>' +
    '<path class="ia-grass ia-o" d="M18 121Q22 98 62 95Q104 97 110 121Q90 130 62 130Q36 130 18 121Z"/>' +
    '<path class="ia-sand ia-o" d="M122 130Q128 152 178 152Q230 150 234 130Q226 112 178 110Q130 112 122 130Z"/>' +
    '<path class="ia-grass2 ia-o" d="M132 128Q138 106 178 104Q216 106 224 128Q202 136 178 136Q150 136 132 128Z"/>' +
    '<path class="ia-wood ia-o" d="M98 124Q119 112 142 126L140 134Q119 122 100 132Z"/>' +
    '<path class="ia-o ia-line" d="M108 119 106 129M119 117 119 127M130 119 132 129"/>' +
    '<path class="ia-woodd ia-o" d="M58 112Q52 84 64 56L73 59Q66 86 70 112Z"/>' +
    '<g class="ia-sway">' +
    '<path class="ia-leaf ia-o" d="M68 57Q44 36 22 52Q46 50 66 64Z"/>' +
    '<path class="ia-leaf2 ia-o" d="M68 57Q70 30 94 22Q82 40 74 62Z"/>' +
    '<path class="ia-leaf ia-o" d="M68 57Q96 40 116 56Q92 54 72 66Z"/>' +
    '<path class="ia-leaf2 ia-o" d="M68 58Q48 64 38 86Q58 72 70 68Z"/>' +
    '<circle class="ia-brown ia-o" cx="63" cy="64" r="4.5"/><circle class="ia-brown ia-o" cx="73" cy="66" r="4.5"/></g>' +
    '<rect class="ia-wood ia-o" x="150" y="98" width="42" height="26" rx="5"/><path class="ia-o ia-line" d="M150 110H192"/>' +
    '<circle class="ia-red ia-o" cx="160" cy="93" r="8"/><circle class="ia-gold ia-o" cx="178" cy="93" r="8"/><circle class="ia-red ia-o" cx="169" cy="80" r="8"/>' +
    '<path class="ia-o ia-line" d="M213 126V98"/><rect class="ia-cream ia-o" x="203" y="84" width="20" height="20" rx="5"/>' +
    '<path class="ia-o ia-sign ia-sign--coral" d="M213 88v12M207 94h12"/>';

  /* 減法島：珊瑚色峭壁＋海蝕拱門；吊車把一個木箱吊走（地上留下虛線空位 = 拿走） */
  const sub = FOAM +
    '<path class="ia-clay ia-o" d="M14 142Q10 112 38 104L60 76Q84 50 118 62L150 56Q192 60 202 94Q232 106 226 142Q200 154 120 154Q40 154 14 142Z"/>' +
    '<path class="ia-o ia-line ia-faint" d="M24 126Q70 118 112 128T218 124M34 112Q80 106 118 112"/>' +
    '<path class="ia-sea ia-o" d="M82 152Q80 112 112 110Q144 112 142 152Z"/>' +
    '<path class="ia-foam ia-foam--arch" d="M88 152Q112 142 136 152Z"/>' +
    '<path class="ia-lawn ia-o" d="M58 86Q84 58 118 68L150 62Q184 64 196 94Q160 84 124 88Q86 86 58 86Z"/>' +
    '<rect class="ia-woodd ia-o" x="168" y="36" width="9" height="56" rx="2"/>' +
    '<path class="ia-woodd ia-o" d="M174 36 104 36 104 43 174 46Z"/>' +
    '<path class="ia-o ia-line" d="M112 44V62"/>' +
    '<g class="ia-swing"><rect class="ia-wood ia-o" x="98" y="62" width="30" height="24" rx="4"/><path class="ia-o ia-line" d="M98 74H128M113 62V86"/></g>' +
    '<rect class="ia-ghost" x="64" y="72" width="28" height="22" rx="4"/>';

  /* 乘法島：風車＋整齊排成 3×2 的向日葵田（一排一排複製 = 乘法） */
  const mul = FOAM +
    '<path class="ia-sand ia-o" d="M6 126Q8 150 120 152Q232 150 234 126Q226 106 120 104Q14 106 6 126Z"/>' +
    '<path class="ia-grass ia-o" d="M16 124Q24 100 120 98Q216 100 224 124Q200 134 120 134Q40 134 16 124Z"/>' +
    '<path class="ia-o ia-line ia-faint" d="M40 122Q120 112 200 122M52 129Q120 121 188 129"/>' +
    '<path class="ia-cream ia-o" d="M50 112 58 68H78L86 112Z"/>' +
    '<path class="ia-woodd ia-o" d="M62 112V98q6-6 12 0V112Z"/>' +
    '<path class="ia-coral ia-o" d="M54 68 68 46 82 68Z"/>' +
    '<g class="ia-blades">' + [45, 135, 225, 315].map(function (r) { return '<rect class="ia-white ia-o" x="63.5" y="24" width="9" height="36" rx="2" transform="rotate(' + r + ' 68 62)"/>'; }).join('') + '</g>' +
    '<circle class="ia-gold ia-o" cx="68" cy="62" r="6"/>' +
    flowers([[122, 108], [150, 108], [178, 108], [122, 124], [150, 124], [178, 124]]);

  function flowers(pts) {
    return pts.map(function (p) {
      const x = p[0], y = p[1];
      return '<path class="ia-o ia-stem" d="M' + x + ' ' + (y + 7) + 'V' + (y + 17) + '"/>' +
        '<circle class="ia-gold ia-o" cx="' + x + '" cy="' + y + '" r="9"/><circle class="ia-brown ia-o" cx="' + x + '" cy="' + y + '" r="4.2"/>';
    }).join('');
  }

  /* 除法島：切成相等份數的蛋糕山，粉紅奶油、櫻桃，山腰插著青綠小旗 */
  const div = FOAM +
    '<path class="ia-cream ia-o" d="M16 142Q14 96 120 84Q226 96 224 142Q200 154 120 154Q40 154 16 142Z"/>' +
    '<path class="ia-pink ia-o" d="M22 118Q16 100 56 92Q86 84 120 84Q154 84 184 92Q224 100 218 118Q208 108 198 120Q190 108 178 122Q168 108 156 120Q146 106 134 120Q122 108 110 120Q100 106 88 120Q76 108 64 122Q54 108 44 120Q32 108 22 118Z"/>' +
    '<path class="ia-o ia-line" d="M120 90Q96 128 70 150M120 90V152M120 90Q144 128 170 150"/>' +
    '<circle class="ia-coral" cx="52" cy="136" r="3.5"/><circle class="ia-teal" cx="84" cy="138" r="3.5"/><circle class="ia-gold" cx="104" cy="132" r="3.5"/><circle class="ia-teal" cx="138" cy="136" r="3.5"/><circle class="ia-coral" cx="162" cy="130" r="3.5"/><circle class="ia-gold" cx="190" cy="136" r="3.5"/>' +
    '<path class="ia-o ia-line" d="M120 78q4-12 12-16"/><circle class="ia-red ia-o" cx="120" cy="78" r="10"/><path class="ia-hi" d="M115 74q2-3 5-3"/>' +
    '<path class="ia-o ia-line" d="M66 100V72M174 100V72"/><path class="ia-teal ia-o" d="M66 72 90 79 66 86Z"/><path class="ia-teal ia-o" d="M174 72 150 79 174 86Z"/>';

  /* 應用題島：翻開的大書就是屋頂，上面飄著對話框；兩旁是故事小屋 */
  const wp = FOAM +
    '<path class="ia-sand ia-o" d="M10 128Q12 152 120 152Q228 152 230 128Q222 110 120 108Q18 110 10 128Z"/>' +
    '<path class="ia-lawn ia-o" d="M18 126Q40 98 84 102Q110 88 150 100Q198 94 222 126Q190 136 120 136Q50 136 18 126Z"/>' +
    '<rect class="ia-cream ia-o" x="28" y="98" width="34" height="28" rx="3"/><path class="ia-violet ia-o" d="M24 98 45 78 66 98Z"/><rect class="ia-woodd ia-o" x="40" y="108" width="10" height="18" rx="2"/>' +
    '<rect class="ia-cream ia-o" x="178" y="98" width="34" height="28" rx="3"/><path class="ia-pink ia-o" d="M174 98 195 78 216 98Z"/><rect class="ia-gold ia-o" x="188" y="106" width="12" height="12" rx="2"/>' +
    '<path class="ia-violet ia-o" d="M76 116Q120 130 164 116L158 108H82Z"/>' +
    '<path class="ia-cream ia-o" d="M84 110 118 100V68L84 78Z"/><path class="ia-cream ia-o" d="M122 100 156 110V78L122 68Z"/>' +
    '<path class="ia-o ia-line ia-faint" d="M90 84 112 77M90 92 112 85M90 100 112 93M130 77 150 84M130 85 150 92M130 93 150 100"/>' +
    '<path class="ia-violet ia-o" d="M118 100h4V68h-4Z"/>' +
    '<g class="ia-float"><path class="ia-white ia-o" d="M100 18h40a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-16l-9 9v-9h-15a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z"/>' +
    '<circle class="ia-violet" cx="108" cy="33" r="3.6"/><circle class="ia-coral" cx="120" cy="33" r="3.6"/><circle class="ia-teal" cx="132" cy="33" r="3.6"/></g>';

  /* 四則運算島：王冠城堡——四座角樓（四種運算）簇擁著戴金冠的主塔 */
  const mix = FOAM +
    '<path class="ia-stone2 ia-o" d="M10 142Q14 122 44 118L60 106H180L196 118Q226 122 230 142Q200 154 120 154Q40 154 10 142Z"/>' +
    turret(38, 84, 26, 40, 'ia-mint') + turret(176, 84, 26, 40, 'ia-pink') +
    turret(68, 66, 28, 56, 'ia-coral') + turret(144, 66, 28, 56, 'ia-gold') +
    '<rect class="ia-stone ia-o" x="98" y="44" width="44" height="78" rx="2"/>' +
    '<path class="ia-o ia-line ia-faint" d="M98 60H142M98 80H142M98 100H142"/>' +
    '<path class="ia-gold ia-o" d="m96 44-3-22 14 9 13-17 13 17 14-9-3 22Z"/><circle class="ia-red ia-o" cx="120" cy="25" r="3.4"/>' +
    '<path class="ia-deep ia-o" d="M108 122V102Q108 90 120 90T132 102V122Z"/><path class="ia-gold ia-o" d="m120 66 3.4 7 7.6 1-5.6 5.2 1.4 7.6-6.8-3.8-6.8 3.8 1.4-7.6L109 74l7.6-1Z"/>';

  function turret(x, y, w, h, roof) {
    const bottom = y + h, cx = x + w / 2;
    return '<rect class="ia-stone ia-o" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>' +
      '<path class="' + roof + ' ia-o" d="M' + (x - 4) + ' ' + y + ' L' + cx + ' ' + (y - 20) + ' L' + (x + w + 4) + ' ' + y + 'Z"/>' +
      '<rect class="ia-deep ia-o" x="' + (cx - 3.5) + '" y="' + (y + 10) + '" width="7" height="12" rx="3.5"/>' +
      '<path class="ia-o ia-line ia-faint" d="M' + x + ' ' + (bottom - 8) + 'H' + (x + w) + '"/>';
  }

  const ART = {
    add: [add, '兩座小島用木橋接在一起，有棕櫚樹和水果箱'],
    sub: [sub, '海邊的紅色峭壁和石拱門，吊車正在吊走一個木箱'],
    mul: [mul, '有風車和三乘二排列整齊的向日葵田'],
    div: [div, '切成相等份數的蛋糕山，頂端有一顆櫻桃'],
    wp: [wp, '一本翻開的大書當屋頂，上面飄著對話框，旁邊有故事小屋'],
    mix: [mix, '有四座角樓和金色王冠主塔的城堡']
  };

  const api = {
    version: '1.0.0', useImages: false, ext: 'svg', labels: ART,
    keys: ['add', 'sub', 'mul', 'div', 'wp', 'mix'],
    svg: function (key) {
      const a = ART[key]; if (!a) return '';
      if (api.useImages) return '<img class="ia-img" src="assets/islands/' + key + '.' + api.ext + '" alt="" width="240" height="170" decoding="async">';
      return wrap(key, a[1], a[0]).replace('role="img" aria-label="' + a[1] + '"', 'aria-hidden="true"');
    }
  };
  return api;
})();

const BoatArt = (function () {
  return {
    /* 帆與桅杆（在船員後面） */
    sail: function (o) {
      o = o || {};
      return '<svg class="bt-sail" viewBox="0 0 72 60" aria-hidden="true" focusable="false">' +
        '<path class="ia-o bt-mast" d="M36 58V6"/>' + (o.noFlag ? '' : '<path class="ia-gold ia-o" d="M36 6 52 11 36 16Z"/>') +
        '<path class="ia-white ia-o" d="M39 16Q58 28 62 52H39Z"/><path class="ia-coral ia-o" d="M39 38Q52 40 60 46L62 52H39Z"/>' +
        '<path class="ia-white ia-o" d="M33 22Q18 32 12 52H33Z"/></svg>';
    },
    /* 船身（蓋在船員的下半身前面） */
    hull: function () {
      return '<svg class="bt-hull" viewBox="0 0 72 30" aria-hidden="true" focusable="false">' +
        '<path class="ia-wood ia-o" d="M3 6H69Q66 24 52 27H20Q6 24 3 6Z"/>' +
        '<path class="ia-woodd" d="M7 12H65Q64 15 63 17H9Q8 15 7 12Z"/>' +
        '<circle class="ia-cream ia-o" cx="24" cy="15" r="3.6"/><circle class="ia-cream ia-o" cx="36" cy="15" r="3.6"/><circle class="ia-cream ia-o" cx="48" cy="15" r="3.6"/></svg>';
    }
  };
})();
