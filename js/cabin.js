/* ==========================================================================
   階段 9E-2：船員小屋（Cabin）—— 畫面、狀態與流程
   * 資料來源：get_student_inventory（物品、星星、補選券、目前裝備）；寫入：claim_reward、redeem_voucher、save_equipped_items，
     以及既有 submit_answer 的 update_progress.avatar（只存制服色）。沒有新增任何後端 action。
   * 星星只是解鎖條件：領取、補選、裝備、換色都不扣星、不改進度、不影響稱號（畫面上也明講）。
   * 試戴（先看看）不會領取、不會儲存、不扣星；裝備與換色先放「草稿」，按「儲存」才寫入，並明確顯示：
     尚未儲存／儲存中／已儲存／無法確認。
   * 兩組資料分開儲存、分開顯示結果：A「裝備與髮色」（save_equipped_items，一次整包）、B「制服色」（既有的角色代碼）。
     只有一組成功時，畫面逐組顯示，絕不出現整體的「全部已儲存」。
   * 領取遇到斷線：先重新查詢；查到已領到 → 顯示成功；沒領到 → 沿用同一個 request_id 再試一次（不會領兩次）。
   * 存裝備無法確認時重新查詢：雲端內容和草稿一樣 → 已儲存；不一樣 → 只說「目前雲端內容與這份草稿不同」，
     不斷言上次儲存失敗，草稿保留給學生確認。
   * 入口：FEATURE_OFF → 隱藏入口；暫時讀不到（斷線、忙碌）→ 入口保留，小屋裡顯示「暫時讀不到，請重試」。
   * 身分：裝備只套用在「本人顯示位置」，由 js/reward-look.js 以登入學生的身分判定，不看角色代碼。
   * 沒有使用任何瀏覽器儲存；request_id、草稿都只在記憶體。
   載入順序：index.html 最後面（reward-art.js、reward-look.js、cabin-net.js 之後）。map.js 以 typeof Cabin 保護，只在海圖顯示時呼叫。
   ========================================================================== */
const Cabin = (function () {
  'use strict';
  const C = RewardArt, CAT = REWARD_CATALOG, I = function (n, o) { return UIKit.icon(n, o); };
  const $ = function (id) { return document.getElementById(id); };
  const SLOT_ORDER = Object.keys(CAT.slots);
  const DESC = {
    badge_starfish: '橘紅色的小海星，別在胸前。', badge_shell: '粉紅色的扇貝，別在胸前。',
    head_sailor_cap: '深藍色水手帽，白色帽沿，帽頂有金色小船錨。', head_straw_hat: '寬寬帽沿的草帽，紅色帽帶。',
    hand_telescope: '三節式小望遠鏡，拿在手上看遠方。', hand_compass: '黃銅外殼的航海羅盤，指針會閃一下。',
    ring_coral: '粉紅色救生圈，圈邊有四顆小珊瑚。', flag_wave: '海藍色旗面，上面有白色波浪線。',
    ring_starsea: '深藍色救生圈，圈上鑲著五顆金星。', ring_aurora: '波浪邊的彩帶救生圈，青、紫、粉一圈一圈。',
    head_crown: '金色皇冠，正中央有一顆白星。', figurehead_star: '會微笑的金色星星，立在船頭。'
  };
  const WHERE = { badge: '別在胸前', head: '戴在頭上', hand: '拿在手上', lifebuoy: '掛在船身', flag: '升在桅杆', figurehead: '立在船頭', ship: '船身' };
  const SLOTNAME = { badge: '徽章', head: '頭上', hand: '手上', lifebuoy: '救生圈', flag: '船旗', figurehead: '船首像', ship: '船身' };
  const SLOTLABEL = { badge1: '徽章 1', badge2: '徽章 2', head: '頭上', hand: '手上', lifebuoy: '救生圈', flag: '船旗', figurehead: '船首像', ship: '船身' };
  const GROUPS = { A: '裝備與髮色', B: '制服色' };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hairName(id) { return (C.HAIR_BY_ID[id] || {}).name || ''; }
  function islandKey(name) { const m = C.ISLANDS.filter(function (i) { return i.name === name; })[0]; return m ? m.k : ''; }
  function islandName(k) { return (C.ISLANDS.filter(function (i) { return i.k === k; })[0] || {}).name || ''; }

  /* ---------- 狀態 ---------- */
  let st = null;            // 小屋畫面狀態（離開小屋就丟掉）
  let root = null;
  const net = { owner: '', status: 'idle', inv: null, lastTry: 0, busy: false, last: null };   // 入口與裝備同步用（登入期間保留）

  function eqOf(effective) {
    const e = {}; SLOT_ORDER.forEach(function (k) { e[k] = (effective && typeof effective[k] === 'string' && effective[k]) ? effective[k] : null; }); return e;
  }
  function cloudOf(src) {                     // src：get_student_inventory／save_equipped_items 的回應或 current
    const ap = (src.equipped && src.equipped.appearance) || {}, h = ap.hair_color;
    return { equip: eqOf(src.effective), hair: (typeof h === 'string' && C.HAIR_BY_ID[h]) ? h : null, version: Number(src.equipped_version != null ? src.equipped_version : src.version) || 0 };
  }
  function snap(s) { return { equip: clone(s.equip), hair: s.hair, uniform: s.uniform }; }
  function groupJSON(g, o) { return g === 'A' ? JSON.stringify([SLOT_ORDER.map(function (k) { return o.equip[k] || null; }), o.hair || null]) : JSON.stringify(o.uniform == null ? null : o.uniform); }
  function isDirty(s, g) { return groupJSON(g, s) !== groupJSON(g, s.saved); }

  /** 把伺服器的物品資料放進畫面狀態。keepDraft：保留草稿（重新查詢、領取後更新用）；沒有被改過的組會跟著雲端更新 */
  function applyInv(s, inv, keepDraft) {
    s.stars = Number(inv.stars) || 0;
    s.owned = {}; C.ITEMS.forEach(function (it) { if (it.starter) s.owned[it.id] = true; });
    (inv.owned || []).forEach(function (o) { s.owned[o.item_id] = true; });
    s.claims = {}; (inv.tiers || []).forEach(function (t) { if (t.state === 'claimed') s.claims[t.tier_id] = t.chosen_item_id; });
    s.vouchers = {}; C.ISLANDS.forEach(function (i) { s.vouchers[i.k] = 'none'; });
    (inv.vouchers || []).forEach(function (v) { const k = islandKey(v.island); if (k) s.vouchers[k] = v.status === 'available' ? 'available' : (v.status === 'used' ? 'used' : 'none'); });
    s.poolIds = Array.isArray(inv.voucher_pool) ? inv.voucher_pool.slice() : [];
    s.usedChoice = {}; (inv.vouchers || []).forEach(function (v) { if (v.status === 'used') s.usedChoice[v.island] = v.chosen_item_id; });
    setCloud(s, cloudOf(inv), keepDraft);
  }
  function setCloud(s, cl, keepDraft) {
    s.cloud = cl;
    if (!s.saved) s.saved = { uniform: null };
    const aClean = !keepDraft || !s.equip || !isDirty(s, 'A');
    s.saved.equip = clone(cl.equip); s.saved.hair = cl.hair;
    if (aClean) { s.equip = clone(cl.equip); s.hair = cl.hair; }
  }
  function makeState(owner, inv) {
    const s = { owner: owner, avatar: String(currentUser.progress.avatar || ''), uniform: null, saved: { uniform: null },
      tab: 'all', slotFilter: null, view: 'items', panel: null, tryOn: null, dialog: null, toast: null, vpick: null, hatOff: null,
      save: { A: 'clean', B: 'clean' }, note: { A: null, B: null } };
    applyInv(s, inv, false);
    return s;
  }

  function owned(s, id) { return !!s.owned[id]; }
  function pool(s) { return s.poolIds.filter(function (id) { return !s.owned[id]; }); }
  function vAvail(s) { return C.ISLANDS.filter(function (i) { return s.vouchers[i.k] === 'available'; }); }
  function status(s, id) {
    const it = C.BY_ID[id];
    if (it.starter) return { k: s.equip[it.slot] === id ? 'equipped' : 'owned', starter: true };
    if (owned(s, id)) { const eqd = s.equip[it.slot === 'badge' ? 'badge1' : it.slot] === id || (it.slot === 'badge' && s.equip.badge2 === id); return { k: eqd ? 'equipped' : 'owned' }; }
    if (s.stars < it.stars) return { k: 'locked', need: it.stars, have: s.stars, miss: it.stars - s.stars };
    if (!s.claims[it.tier]) return { k: 'claimable' };
    return { k: pool(s).indexOf(id) >= 0 && vAvail(s).length ? 'pool' : 'notchosen' };
  }
  function slotKeyFor(s, it, eqObj) {
    if (it.slot !== 'badge') return it.slot;
    if (!eqObj.badge1) return 'badge1';
    if (!eqObj.badge2 && s.stars >= (CAT.slots.badge2.min_stars || 0)) return 'badge2';
    return 'badge1';
  }
  function hatOffNow(s) { return s.view === 'look' && s.hatOff !== false; }
  function previewEquip(s) {
    const e = Object.assign({}, s.equip);
    if (s.tryOn) { const it = C.BY_ID[s.tryOn]; e[slotKeyFor(s, it, e)] = s.tryOn; }
    if (hatOffNow(s)) e.head = null;
    return e;
  }
  function uniIdx(s) { const a = AvatarKit.parse(s.avatar); return s.uniform == null ? a.col : s.uniform; }
  function hairHex(s) { return s.hair == null ? null : C.hairHex(s.hair); }
  function charOpt(s) { return { hair: hairHex(s), uniform: s.uniform == null ? null : s.uniform, noHat: hatOffNow(s) }; }

  /* ---------- 儲存狀態（A、B 兩組分開） ---------- */
  function effState(s, g) {
    const v = s.save[g];
    if (v === 'saving' || v === 'unknown' || v === 'saved' || v === 'checking' || v === 'failed') return v;
    return isDirty(s, g) ? 'dirty' : 'clean';
  }
  function dirtyLike(s, g) { const v = effState(s, g); return v === 'dirty' || v === 'failed'; }
  function busy(s) { return ['A', 'B'].some(function (g) { const v = effState(s, g); return v === 'saving' || v === 'checking'; }); }
  function diffText(s, g) {
    const out = [];
    if (g === 'A') {
      SLOT_ORDER.forEach(function (k) {
        if ((s.equip[k] || null) !== (s.saved.equip[k] || null)) out.push(SLOTLABEL[k] + '：' + (s.equip[k] ? C.BY_ID[s.equip[k]].name : '拿下'));
      });
      if ((s.hair || null) !== (s.saved.hair || null)) out.push('髮色：' + (s.hair == null ? '原本髮色' : hairName(s.hair)));
    } else if (s.uniform !== s.saved.uniform) {
      out.push('制服色：' + AvatarKit.COLORS[uniIdx(s)].name);
    }
    return out.join('、');
  }
  function spin() { return '<svg class="cb-spin" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#17324D" stroke-opacity=".2" stroke-width="4"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="#17324D" stroke-width="4" stroke-linecap="round"/></svg>'; }
  function saveBar(s) {
    const rows = ['A', 'B'].map(function (g) {
      const v = effState(s, g); if (v === 'clean') return '';
      const nm = GROUPS[g], note = s.note[g] ? '<span class="cb-sv__note">' + esc(s.note[g]) + '</span>' : '';
      if (v === 'dirty') return '<div class="cb-sv cb-sv--dirty" role="status"><span class="cb-sv__ico">' + I('info') + '</span><span class="cb-sv__txt"><b>' + nm + '：尚未儲存</b><span>' + esc(diffText(s, g)) + '</span>' + note + '</span></div>';
      if (v === 'saving' || v === 'checking') return '<div class="cb-sv cb-sv--saving" role="status"><span class="cb-sv__ico">' + spin() + '</span><span class="cb-sv__txt"><b>' + nm + '：' + (v === 'checking' ? '重新查詢中…' : '儲存中…') + '</b><span>請稍等，先不要關掉畫面。</span></span></div>';
      if (v === 'saved') return '<div class="cb-sv cb-sv--saved" role="status"><span class="cb-sv__ico">' + I('check') + '</span><span class="cb-sv__txt"><b>' + nm + '：已儲存</b></span></div>';
      if (v === 'failed') return '<div class="cb-sv cb-sv--failed" role="alert"><span class="cb-sv__ico">' + I('warn') + '</span><span class="cb-sv__txt"><b>' + nm + '：這次沒有儲存</b><span>' + esc(diffText(s, g)) + '</span>' + note + '</span></div>';
      return '<div class="cb-sv cb-sv--unknown" role="alert"><span class="cb-sv__ico">' + I('warn') + '</span><span class="cb-sv__txt"><b>' + nm + '：無法確認有沒有儲存成功</b><span>' + (g === 'A' ? '連線中斷了。先按「重新查詢」，我們會去看目前雲端存的是什麼。' : '連線中斷了。制服色沒有查詢功能，請按「再存一次」；同一個顏色重複存沒有副作用。') + '</span>' + note + '</span></div>';
    }).join('');
    if (!rows) return '';
    const anyDirty = dirtyLike(s, 'A') || dirtyLike(s, 'B');
    const unA = effState(s, 'A') === 'unknown', unB = effState(s, 'B') === 'unknown', b = busy(s);
    const btns = (anyDirty ? '<button type="button" class="cb-btn cb-btn--gold" data-act="save"' + (b ? ' disabled' : '') + '>儲存</button><button type="button" class="cb-btn cb-btn--ghost" data-act="revert"' + (b ? ' disabled' : '') + '>還原</button>' : '') +
      ((unA || unB) ? '<button type="button" class="cb-btn cb-btn--sea" data-act="requery"' + (b ? ' disabled' : '') + '>' + (unA ? (unB ? '重新查詢，並再存制服色' : '重新查詢') : '再存一次') + '</button>' : '');
    return '<section class="cb-savebar" aria-label="儲存狀態">' + rows + (btns ? '<div class="cb-savebar__btns">' + btns + '</div>' : '') + '</section>';
  }


  /* ---------- 小件 ---------- */
  function statLine(s) {
    if (s.k === 'equipped') return I('check') + '<span>裝備中</span>';
    if (s.k === 'owned') return s.starter ? '<span>起始裝備</span>' : '<span>已擁有</span>';
    if (s.k === 'claimable') return I('star') + '<span>可領取・二選一</span>';
    if (s.k === 'pool') return I('plus') + '<span>可用補選券領取</span>';
    if (s.k === 'notchosen') return I('info') + '<span>這組選了另一件</span>';
    return I('lock') + '<span>未解鎖</span>';
  }
  function ariaFor(st, id, s) {
    const it = C.BY_ID[id];
    let t = it.name + '，' + C.RARITY[it.rarity].label + '，';
    if (s.k === 'locked') t += '未解鎖，需要' + s.need + '顆星，目前' + s.have + '顆，還差' + s.miss + '顆';
    else t += { equipped: '裝備中', owned: '已擁有', claimable: '可領取，二選一', pool: '可用補選券領取', notchosen: '這組選了另一件' }[s.k];
    return t;
  }
  function itemCard(st, id, o) {
    o = o || {};
    const it = C.BY_ID[id], s = status(st, id);
    let need = '';
    if (s.k === 'locked') {
      const pct = Math.max(4, Math.round(s.have / s.need * 100));
      need = '<span class="cb-need"><span class="row"><span>需要 <b>' + s.need + '★</b></span><span>目前 <b>' + s.have + '★</b></span></span>' +
        '<span class="cb-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span><span class="cb-miss">還差 <b>' + s.miss + '★</b></span></span>';
    }
    const tried = st.tryOn === id ? ' cb-item--tried' : '';
    return '<button type="button" class="cb-item cb-item--' + s.k + tried + '" data-act="item" data-id="' + id + '" aria-label="' + esc(ariaFor(st, id, s)) + '">' +
      C.icon(id, { size: o.size || 92, label: false }) + '<span class="cb-item__name">' + it.name + '</span>' + C.rarityChip(it.rarity) +
      (s.k === 'locked' ? '' : '<span class="cb-item__stat">' + statLine(s) + '</span>') + need + '</button>';
  }
  /* 階段 9F-3（Q13）：目前稱號。規則來源只有 ProgressSystem（js/map.js，和海圖頂端、稱號航線同一份門檻）；星數是這位學生自己的 get_student_inventory 星數。讀不到就不顯示，不影響其他部分。 */
  function titleOf(st) {
    try { return (typeof ProgressSystem !== 'undefined' && ProgressSystem.getTitle) ? String(ProgressSystem.getTitle(Number(st.stars) || 0).title || '') : ''; } catch (e) { return ''; }
  }
  function describeLook(st) {
    const a = AvatarKit.parse(st.avatar), e = st.equip, parts = [AvatarKit.CREW[a.c - 1].name];
    const ti = titleOf(st); if (ti) parts.push('稱號：' + ti);
    ['badge1', 'badge2', 'head', 'hand', 'lifebuoy', 'flag', 'figurehead'].forEach(function (k) { if (e[k]) parts.push(C.BY_ID[e[k]].name); });
    return parts.join('、');
  }

  /* ---------- 展示間（船艙工作室：木牆、圓舷窗＋海浪、層板、繩結；裝飾全部不接收點擊） ---------- */
  const PORTHOLE = '<svg class="cb-porthole" viewBox="0 0 80 80" aria-hidden="true" focusable="false"><defs><clipPath id="cb-pc"><circle cx="40" cy="40" r="27"/></clipPath></defs><circle cx="40" cy="40" r="35" fill="#E8B77C" stroke="#17324D" stroke-width="3"/><circle cx="40" cy="40" r="27" fill="#8FE6EE"/>' +
    '<g clip-path="url(#cb-pc)"><circle cx="54" cy="27" r="6" fill="#FFD166" stroke="#17324D" stroke-width="2"/><path d="M20 24q6-5 12 0t12 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>' +
    '<g class="cb-wave cb-wave--b"><path d="M-6 49Q4 43 14 49T34 49T54 49T74 49T94 49V70H-6Z" fill="#5DD6E4"/></g><g class="cb-wave cb-wave--a"><path d="M-6 56Q4 50 14 56T34 56T54 56T74 56T94 56V70H-6Z" fill="#20C5D8"/></g></g>' +
    '<circle cx="40" cy="40" r="27" fill="none" stroke="#17324D" stroke-width="3"/><path d="M13 40A27 27 0 0 1 40 13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>';
  const SHELF = '<svg class="cb-shelf" viewBox="0 0 150 64" aria-hidden="true" focusable="false"><rect x="4" y="46" width="142" height="11" rx="4" fill="#E8B77C" stroke="#17324D" stroke-width="2.5"/><path d="M20 57l-5 7M130 57l5 7" stroke="#17324D" stroke-width="2.5" stroke-linecap="round"/>' +
    '<rect x="18" y="31" width="30" height="7" rx="2" fill="#8B6FE8" stroke="#17324D" stroke-width="2.2"/><rect x="21" y="24" width="26" height="7" rx="2" fill="#FF7A59" stroke="#17324D" stroke-width="2.2"/><rect x="18" y="38" width="32" height="8" rx="2" fill="#47C98B" stroke="#17324D" stroke-width="2.2"/>' +
    '<path d="M92 46h24l-3-14H95z" fill="#FFF3D6" stroke="#17324D" stroke-width="2.2" stroke-linejoin="round"/><path d="M104 32c-8-2-10-10-6-14 3 5 6 7 6 14zM104 32c8-2 10-10 6-14-3 5-6 7-6 14z" fill="#47C98B" stroke="#17324D" stroke-width="2.2" stroke-linejoin="round"/></svg>';
  const KNOT = '<svg class="cb-knot" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M6 4c4 14 10 22 18 22s14-8 18-22" fill="none" stroke="#17324D" stroke-width="6.5" stroke-linecap="round"/><path d="M6 4c4 14 10 22 18 22s14-8 18-22" fill="none" stroke="#F2D6A0" stroke-width="3.2" stroke-linecap="round"/><circle cx="24" cy="30" r="7.5" fill="#F2D6A0" stroke="#17324D" stroke-width="2.5"/><path d="M19 30q5 4 10 0" fill="none" stroke="#17324D" stroke-width="2" stroke-linecap="round"/></svg>';
  function stage(st) {
    const a = AvatarKit.parse(st.avatar), pe = previewEquip(st), ch = AvatarKit.CREW[a.c - 1], co = charOpt(st);
    const uni = AvatarKit.COLORS[st.uniform == null ? a.col : st.uniform].name;
    return '<div class="cb-stage" role="group" aria-label="展示間：' + esc(describeLook(st)) + '">' +
      '<div class="cb-name"><span class="cb-pill">' + esc(ch.name) + '</span>' + (titleOf(st) ? '<span class="cb-pill cb-pill--title">稱號：' + esc(titleOf(st)) + '</span>' : '') + '<span class="cb-pill">制服：' + uni + '</span><span class="cb-pill">髮色：' + (st.hair == null ? '原本' : hairName(st.hair)) + '</span>' +
      (st.tryOn ? '<span class="cb-pill cb-pill--try">' + I('info') + '試戴中：' + C.BY_ID[st.tryOn].name + '（還沒領取）</span>' : '') +
      (hatOffNow(st) ? '<span class="cb-pill cb-pill--try">' + I('info') + '髮型預覽：暫時摘下帽子</span>' : '') + '</div>' +
      '<div class="cb-scene"><div class="cb-wall"></div><div class="cb-floor"></div>' + PORTHOLE + SHELF + KNOT +
      '<div class="cb-crew"><span class="cb-rug"></span>' + C.crewSVG(st.avatar, pe, co) + '</div>' +
      '<div class="cb-boatbox"><span class="cb-tray"></span>' + C.boatHTML(st.avatar, pe, 'css', { crew: co }) + '</div></div></div>';
  }
  function slotBar(st) {
    const items = C.SLOTS.map(function (s) {
      const locked = s.min && st.stars < s.min;
      const cur = st.equip[s.k];
      const key = s.k.replace(/\d$/, '');
      const pressed = st.slotFilter === key ? 'true' : 'false';
      if (locked) return '<button type="button" class="cb-slot cb-slot--locked" disabled aria-label="' + s.name + '，' + s.min + '顆星才開啟，目前' + st.stars + '顆，還差' + (s.min - st.stars) + '顆">' + '<span class="cb-slot__pic">' + I('lock') + '</span><span class="cb-slot__name">' + s.name + '</span><span class="cb-slot__cur">' + s.min + '★ 開啟</span></button>';
      const pic = cur ? C.art(cur, 40) : '<span class="cb-slot__empty">空</span>';
      const changed = st.saved && cur !== st.saved.equip[s.k] ? '<span class="cb-slot__dot" title="尚未儲存">未存</span>' : '';
      return '<button type="button" class="cb-slot" data-act="slot" data-slot="' + key + '" aria-pressed="' + pressed + '" aria-label="' + s.name + '：' + (cur ? C.BY_ID[cur].name : '空') + (changed ? '，尚未儲存' : '') + '，點一下只看這一欄的物品">' + changed +
        '<span class="cb-slot__pic">' + pic + '</span><span class="cb-slot__name">' + s.name + '</span><span class="cb-slot__cur">' + (cur ? C.BY_ID[cur].name : '還沒裝') + (s.fixed ? '（固定）' : '') + '</span></button>';
    }).join('');
    return '<section class="cb-card cb-slotbar" aria-labelledby="cb-eq-h"><h2 id="cb-eq-h">裝備欄 <small>點一欄，只看那一欄的物品</small></h2><div class="cb-slots">' + items + '</div></section>';
  }

  /* ---------- 補選券列 ---------- */
  function voucherRow(st) {
    const toks = C.ISLANDS.map(function (i) {
      const v = st.vouchers[i.k];
      if (v === 'available') return '<span class="cb-vtoken cb-vtoken--ok">' + I('check') + i.name + '・可用</span>';
      if (v === 'used') return '<span class="cb-vtoken cb-vtoken--used">' + I('close') + i.name + '・已用過</span>';
      return '<span class="cb-vtoken cb-vtoken--none">' + I('lock') + i.name + '・還沒有</span>';
    }).join('');
    const n = vAvail(st).length, p = pool(st);
    const can = n > 0 && p.length > 0;
    return '<section class="cb-card" aria-labelledby="cb-v-h"><h2 id="cb-v-h">島嶼大師補選券 <small>每座島一張，島上三區各拿 3★ 就有</small></h2><div class="cb-vouchers">' + toks + '</div>' +
      '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="cb-btn cb-btn--gold" data-act="open-voucher"' + (can ? '' : ' disabled') + '>' + I('plus') + '使用補選券（可補選 ' + p.length + ' 件）</button>' +
      (n === 0 ? '<span class="cb-note" style="flex:1 1 220px">' + I('info') + '<span>還沒有可用的券。把一座島的三個區域都拿到 3★ 就會得到。</span></span>' : (p.length === 0 ? '<span class="cb-note cb-note--warn" style="flex:1 1 220px">' + I('info') + '<span>現在沒有可以補選的物品，券不會被用掉。</span></span>' : '')) + '</div></section>';
  }

  /* ---------- 星星路線（二選一分組） ---------- */
  function tierBlock(st, t) {
    const open = st.stars >= t.stars, claimed = st.claims[t.id];
    const sub = !open ? '還差 ' + (t.stars - st.stars) + '★' : (claimed ? '已選：' + C.BY_ID[claimed].name : '二選一・只能先選一件');
    const head = '<h3 class="cb-tier__head">' + I(open ? 'star' : 'lock', { size: 28 }) + '<span>' + t.stars + '★ 寶箱</span>' + C.rarityChip(t.rarity) + '<span class="sub">' + sub + '</span></h3>';
    return '<section class="cb-tier' + (open && !claimed ? ' cb-tier--open' : '') + '" aria-label="' + t.stars + '顆星寶箱">' + head +
      '<div class="cb-pair">' + itemCard(st, t.items[0]) + '<span class="cb-or" aria-label="二選一">或</span>' + itemCard(st, t.items[1]) + '</div></section>';
  }
  function collection(st) {
    const cnt = { owned: 0, claimable: 0, locked: 0 };
    C.ITEMS.forEach(function (it) { const s = status(st, it.id); if (s.k === 'equipped' || s.k === 'owned') cnt.owned++; });
    C.TIERS.forEach(function (t) { if (st.stars < t.stars) cnt.locked++; else if (!st.claims[t.id]) cnt.claimable++; });
    const tabs = [['all', '全部'], ['owned', '已擁有', cnt.owned], ['claimable', '可領取', cnt.claimable + (vAvail(st).length && pool(st).length ? pool(st).length : 0)], ['locked', '未解鎖', cnt.locked]]
      .map(function (t) { return '<button type="button" role="tab" class="cb-tab" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (st.tab === t[0] && !st.slotFilter ? 'true' : 'false') + '">' + t[1] + (t[2] != null ? '<span class="cnt">' + t[2] + '</span>' : '') + '</button>'; }).join('');
    let body = '';
    if (st.slotFilter) {
      const list = C.ITEMS.filter(function (it) { return it.slot === st.slotFilter; });
      body = '<div class="cb-note">' + I('info') + '<span>只看「' + SLOTNAME[st.slotFilter] + '」這一欄的物品。<button type="button" class="cb-btn cb-btn--ghost" style="min-height:48px;margin-left:8px" data-act="slot-clear">看全部</button></span></div><div class="cb-grid">' + list.map(function (it) { return itemCard(st, it.id); }).join('') + '</div>';
    } else if (st.tab === 'all') {
      body = '<section class="cb-tier" aria-label="起始裝備"><h3 class="cb-tier__head"><span>起始裝備</span>' + C.rarityChip('starter') + '<span class="sub">人人都有，不能拿走</span></h3><div class="cb-grid">' +
        ['ship_basic', 'ring_stripe', 'flag_default'].map(function (id) { return itemCard(st, id, { size: 80 }); }).join('') + '</div></section>' + C.TIERS.map(function (t) { return tierBlock(st, t); }).join('');
    } else if (st.tab === 'owned') {
      body = '<div class="cb-grid">' + C.ITEMS.filter(function (it) { const s = status(st, it.id).k; return s === 'equipped' || s === 'owned'; }).map(function (it) { return itemCard(st, it.id); }).join('') + '</div>';
    } else if (st.tab === 'claimable') {
      const ts = C.TIERS.filter(function (t) { return st.stars >= t.stars && !st.claims[t.id]; }).map(function (t) { return tierBlock(st, t); }).join('');
      const ps = pool(st).filter(function () { return vAvail(st).length; });
      body = ts + (ps.length ? '<section class="cb-tier"><h3 class="cb-tier__head"><span>可用補選券領取</span><span class="sub">用一張券，補選這組沒選到的</span></h3><div class="cb-grid">' + ps.map(function (id) { return itemCard(st, id); }).join('') + '</div></section>' : '') || '<div class="cb-note">' + I('info') + '<span>現在沒有可以領的。繼續闖關拿星星吧！</span></div>';
    } else {
      body = C.TIERS.filter(function (t) { return st.stars < t.stars; }).map(function (t) { return tierBlock(st, t); }).join('') || '<div class="cb-note cb-note--ok">' + I('check') + '<span>所有寶箱都解鎖了！</span></div>';
    }
    return '<div class="cb-tabs" role="tablist" aria-label="物品分類">' + tabs + '</div>' + body;
  }

  /* ---------- 外觀分頁 ---------- */
  function appearance(st) {
    const a = AvatarKit.parse(st.avatar), legacy = !!a.legacy;
    const uni = AvatarKit.COLORS.map(function (c, i) {
      const cur = st.uniform == null ? a.col : st.uniform;
      return '<button type="button" class="cb-sw" data-act="uni" data-i="' + i + '" aria-pressed="' + (cur === i ? 'true' : 'false') + '"' + (legacy ? ' disabled' : '') + '><span class="cb-sw__dot" style="background:' + c.main + '"></span>' + c.name + '</button>';
    }).join('');
    const hair = ['<button type="button" class="cb-sw" data-act="hair" data-k="" aria-pressed="' + (st.hair == null ? 'true' : 'false') + '"><span class="cb-sw__dot" style="background:' + AvatarKit.CREW[a.c - 1].hair + '"></span>原本髮色</button>']
      .concat(C.HAIR_PALETTE.map(function (c) { return '<button type="button" class="cb-sw" data-act="hair" data-k="' + c.k + '" aria-pressed="' + (st.hair === c.k ? 'true' : 'false') + '"><span class="cb-sw__dot" style="background:' + c.c + '"></span>' + c.name + '</button>'; })).join('');
    return '<section class="cb-card"><h2>制服顏色</h2><div class="cb-swatches" role="group" aria-label="制服顏色">' + uni + '</div>' +
      (legacy ? '<p class="cb-sv__note" style="margin:8px 0 0">這個帳號用的是舊版頭像，不能在小屋換制服色。想換的話，請到選角色畫面重新選一位船員。</p>' : '') + '</section>' +
      '<section class="cb-card"><h2>髮色</h2><div class="cb-swatches" role="group" aria-label="髮色">' + hair + '</div>' +
      '<div style="margin-top:10px"><button type="button" class="cb-btn cb-btn--ghost" data-act="hatoff" aria-pressed="' + (hatOffNow(st) ? 'true' : 'false') + '">' + (hatOffNow(st) ? '把帽子戴回去（看完整造型）' : '摘下帽子看髮型') + '</button>' +
      '<p style="margin:8px 0 0;font:600 15px/1.5 var(--font-sans)">摘下帽子只是預覽，不會儲存，也不會改你的裝備。</p></div></section>';
  }

  /* ---------- 二選一／補選面板 ---------- */
  function choice(st, id, via) {
    const it = C.BY_ID[id], trying = st.tryOn === id;
    return '<div class="cb-choice' + (trying ? ' cb-choice--try' : '') + '">' + C.icon(id, { size: 112, label: false }) +
      '<span class="cb-choice__name">' + it.name + '</span>' + C.rarityChip(it.rarity) +
      '<span class="cb-choice__desc">' + WHERE[it.slot] + '。' + DESC[id] + '</span>' +
      '<span class="cb-choice__btns"><button type="button" class="cb-btn cb-btn--sea" data-act="try" data-id="' + id + '" aria-pressed="' + (trying ? 'true' : 'false') + '">' + (trying ? '脫下試戴' : '先試戴看看') + '</button>' +
      '<button type="button" class="cb-btn cb-btn--go" data-act="choose" data-id="' + id + '" data-via="' + via + '">選這件</button></span></div>';
  }
  function panel(st) {
    const p = st.panel; if (!p) return '';
    if (p.t === 'pair') {
      const t = C.TIERS.filter(function (x) { return x.id === p.tier; })[0];
      return '<section class="cb-panel" aria-labelledby="cb-pn-h"><h2 id="cb-pn-h">' + t.stars + '★ 寶箱：二選一</h2>' +
        '<p>只能選一件。可以先「試戴」，試戴不會領走、不扣星。</p>' +
        '<div class="cb-panelrow">' + choice(st, t.items[0], 'tier') + choice(st, t.items[1], 'tier') + '</div>' +
        '<div class="cb-note cb-note--warn">' + I('info') + '<span>選好之後，這組沒選的那一件，要用「島嶼大師補選券」才能補選。</span></div>' +
        '<button type="button" class="cb-btn cb-btn--ghost" data-act="close-panel">先不領，回收藏</button></section>';
    }
    const ps = pool(st);
    if (!ps.length) return '<section class="cb-panel"><h2>島嶼大師補選券</h2><div class="cb-note cb-note--warn">' + I('info') + '<span>現在沒有可以補選的物品，<b>券沒有被用掉</b>。補選只能選「星星已經夠、而且那一組已經選過一件」的另一件。</span></div><button type="button" class="cb-btn cb-btn--ghost" data-act="close-panel">回收藏</button></section>';
    return '<section class="cb-panel" aria-labelledby="cb-pn-h"><h2 id="cb-pn-h">島嶼大師補選券：補選一件</h2>' +
      '<p>用 1 張券補選 1 件，可以先試戴。按「選這件」後，會在確認畫面選用哪一座島的券。</p>' +
      '<div class="cb-panelrow">' + ps.map(function (id) { return choice(st, id, 'voucher'); }).join('') + '</div>' +
      '<button type="button" class="cb-btn cb-btn--ghost" data-act="close-panel">先不用，回收藏</button></section>';
  }

  /* ---------- 對話框 ---------- */
  function spinner() { return '<svg class="cb-spin" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#17324D" stroke-opacity=".2" stroke-width="4"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="#17324D" stroke-width="4" stroke-linecap="round"/></svg>'; }
  function burst() { let s = ''; for (let i = 0; i < 8; i++) s += '<i style="--a:' + (i * 45) + 'deg"></i>'; return '<span class="cb-burst" aria-hidden="true">' + s + '</span>'; }
  function who(it, size) { return '<div class="cb-dialog__who">' + C.icon(it.id, { size: size || 88, label: false }) + '<div>' + C.rarityChip(it.rarity) + '<div style="font:700 16px/1.4 var(--font-sans);margin-top:4px">' + it.name + '・' + WHERE[it.slot] + '</div></div></div>'; }

  function dialog(s) {
    const d = s.dialog; if (!d) return '';
    const wrap = function (role, h, body) { return '<div class="cb-overlay"><div class="cb-dialog" role="' + role + '" aria-modal="true" aria-labelledby="cb-dg-h"><h2 id="cb-dg-h">' + h + '</h2>' + body + '</div></div>'; };
    if (d.t === 'leave') {
      return wrap('dialog', '還有沒儲存的變更', '<p>你換了裝備或顏色，但還沒儲存成功。現在離開，這些變更不會留下來。</p>' +
        '<div class="cb-dialog__stack"><button type="button" class="cb-btn cb-btn--gold" data-act="leave-save">先儲存再離開</button><button type="button" class="cb-btn cb-btn--ghost" data-act="leave-drop">不儲存，直接離開</button><button type="button" class="cb-btn cb-btn--sea" data-act="dlg-cancel">留在小屋</button></div>');
    }
    if (d.t === 'error') {
      return wrap('alertdialog', esc(d.title || '這次沒有成功'), '<p>' + esc(d.msg || '') + '</p><div class="cb-dialog__acts"><button type="button" class="cb-btn cb-btn--sea" data-act="dlg-later">知道了</button></div>');
    }
    const it = C.BY_ID[d.id], vname = d.via === 'voucher' ? islandName(s.vpick || d.island) : null, av = vAvail(s);
    if (d.t === 'confirm') {
      const other = it.pair ? C.BY_ID[it.pair].name : '';
      let body;
      if (d.via === 'tier') {
        body = '<p>這一組（' + it.stars + '★ 寶箱）只能選一件。沒選的<b>「' + other + '」</b>不能直接領了，之後要用「島嶼大師補選券」才能補選。星星<b>不會被扣掉</b>。</p>' +
          '<p class="cb-final">你選的是：<span class="cb-nw">「' + it.name + '」</span></p>';
      } else {
        const pick = '<div class="cb-vpick"><b>要用哪一座島的券？</b>' + (av.length > 1 ? '<div class="cb-radio" role="radiogroup" aria-label="選擇要用的補選券">' + av.map(function (i) { return '<button type="button" role="radio" data-act="vsel" data-k="' + i.k + '" aria-checked="' + ((s.vpick || d.island) === i.k ? 'true' : 'false') + '">' + i.name + '補選券</button>'; }).join('') + '</div>' : '<span class="cb-vone">' + vname + '補選券（只有這一張可用）</span>') + '</div>';
        body = '<p>用掉後這張券就<b>沒有了</b>，也不能退回；星星<b>不會被扣掉</b>。</p>' + pick + '<p class="cb-final">用掉<span class="cb-nw">「' + vname + '」補選券</span>，領取<span class="cb-nw">「' + it.name + '」</span></p>';
      }
      return wrap('dialog', '確定' + (d.via === 'tier' ? '選' : '補選') + '「' + it.name + '」嗎？', who(it) + body +
        '<div class="cb-dialog__acts"><button type="button" class="cb-btn cb-btn--ghost" data-act="dlg-cancel">再想想</button><button type="button" class="cb-btn cb-btn--go" data-act="dlg-ok">確定，' + (d.via === 'tier' ? '領取' : '用券領取') + '</button></div>');
    }
    if (d.t === 'working') return wrap('alertdialog', spinner() + ' 領取中…', who(it, 72) + '<p>請稍等，先不要關掉畫面。</p>');
    if (d.t === 'unsure') return wrap('alertdialog', spinner() + ' 還不確定有沒有領到', who(it, 72) + '<p>連線中斷了，所以<b>還不確定</b>有沒有領成功。我們正在重新查詢結果，<b>不會重複領取</b>。</p>');
    if (d.t === 'unsure2') return wrap('alertdialog', '還是連不上網路', who(it, 72) + '<p>暫時查不到結果，所以<b>還不確定</b>有沒有領到。可以再查一次；也可以先關掉，之後打開船員小屋就會看到真正的結果。</p>' +
      '<div class="cb-dialog__acts"><button type="button" class="cb-btn cb-btn--ghost" data-act="dlg-later">先關掉</button><button type="button" class="cb-btn cb-btn--sea" data-act="dlg-recheck">再查一次</button></div>');
    if (d.t === 'retry') return wrap('alertdialog', '查詢結果：還沒有領到', who(it, 72) + '<div class="cb-note cb-note--warn">' + I('info') + '<span>雲端上沒有這次的領取紀錄。按「再試一次」會沿用同一個申請，就算前一次其實已經送到，也<b>不會領兩次</b>。</span></div>' +
      '<div class="cb-dialog__acts"><button type="button" class="cb-btn cb-btn--ghost" data-act="dlg-later">先不領</button><button type="button" class="cb-btn cb-btn--go" data-act="dlg-retry">再試一次</button></div>');
    /* done */
    return '<div class="cb-overlay"><div class="cb-dialog cb-dialog--done" role="dialog" aria-modal="true" aria-labelledby="cb-dg-h">' + burst() + '<h2 id="cb-dg-h">拿到了！</h2>' +
      '<div class="cb-dialog__who">' + C.icon(it.id, { size: 96, label: false }) + '<div><b style="font:900 19px var(--font-sans)">' + it.name + '</b><div style="margin-top:4px">' + C.rarityChip(it.rarity) + '</div></div></div>' +
      (d.recovered ? '<div class="cb-note cb-note--ok">' + I('check') + '<span>重新查詢後確認：這件已經領到了（只有一筆）。</span></div>' : '') +
      (d.listStale ? '<div class="cb-note cb-note--warn">' + I('info') + '<span>清單暫時沒有更新成功，關掉這個視窗後可以重新打開小屋看最新的。</span></div>' : '') +
      '<p>「' + it.name + '」已經放進你的收藏。' + (d.via === 'voucher' ? '「' + islandName(d.island) + '」補選券已用完。' : '') + '<br>要不要現在裝上去？裝上去之後還要按「儲存」才會留下來。</p>' +
      '<div class="cb-dialog__acts"><button type="button" class="cb-btn cb-btn--ghost" data-act="dlg-later">先不要</button><button type="button" class="cb-btn cb-btn--mint" data-act="dlg-equip">現在就裝備</button></div></div></div>';
  }

  /* 小屋框（.cabin）和對話框／提示分開輸出：container 會讓裡面的 fixed 變成相對於框，所以對話框放在框外面 */
  function shell(inner, extra) {
    return '<div class="cabin" data-cabin' + (extra || '') + '><header class="cb-top"><button type="button" class="cb-back" data-act="back">' + I('back') + '回海圖</button><h1>船員小屋</h1>' +
      (st && st.stars != null ? '<span class="cb-stars">' + I('star') + '目前 ' + st.stars + '★</span>' : '') + '</header>' + inner + '</div>';
  }
  function html(s) {
    const left = '<div class="cb-left">' + stage(s) + saveBar(s) + slotBar(s) + '</div>';
    const tabs = '<div class="cb-tabs" role="tablist" aria-label="小屋分頁"><button type="button" role="tab" class="cb-tab" data-act="view" data-view="items" aria-selected="' + (s.view === 'items' ? 'true' : 'false') + '">物品收藏</button><button type="button" role="tab" class="cb-tab" data-act="view" data-view="look" aria-selected="' + (s.view === 'look' ? 'true' : 'false') + '">外觀</button></div>';
    let right;
    if (s.panel) right = panel(s);
    else if (s.view === 'look') right = tabs + appearance(s);
    else right = tabs + voucherRow(s) + collection(s);
    const note = '<p class="cb-fine">星星只是解鎖條件：領取、補選、裝備、換色都不會扣掉星星，也不影響稱號和學習進度。</p>';
    const main = shell('<div class="cb-main">' + left + '<div class="cb-right">' + right + note + '</div></div>', s.panel ? ' data-panel="1"' : '');
    const over = dialog(s) + (s.toast ? '<div class="cb-toast" role="status">' + esc(s.toast) + '</div>' : '');
    return s.dialog ? main.replace('<div class="cabin" data-cabin', '<div class="cabin" data-cabin inert') + over : main + over;
  }

  /* ---------- 載入中／讀取失敗 ---------- */
  function stateView(kind, msg) {
    let h, p, acts = '<button type="button" class="cb-btn cb-btn--ghost" data-act="back">回海圖</button>';
    if (kind === 'loading') { h = spinner() + '正在打開船員小屋…'; p = '請稍等一下。'; acts = '<button type="button" class="cb-btn cb-btn--ghost" data-act="back">回海圖</button>'; }
    else if (kind === 'session') { h = I('warn') + '登入需要更新'; p = msg || '登入已經過期了，請回到首頁重新登入。'; }
    else if (kind === 'schema') { h = I('info') + '船員小屋還沒準備好'; p = '後端的資料表還沒有建立好，請告訴老師。你的星星和進度都沒有受影響。'; acts = '<button type="button" class="cb-btn cb-btn--sea" data-act="retry-load">再試一次</button>' + acts; }
    else if (kind === 'off') { h = I('info') + '船員小屋目前沒有開放'; p = '這個功能現在還沒有開放。你的星星和進度都沒有受影響。'; }
    else if (kind === 'error') { h = I('warn') + '這次沒有成功'; p = msg || '請稍後再試一次。你的星星和進度都沒有受影響。'; acts = '<button type="button" class="cb-btn cb-btn--sea" data-act="retry-load">再試一次</button>' + acts; }
    else { h = I('warn') + '暫時讀不到，請重試'; p = '網路好像不太穩，或是系統正在忙。你的星星和進度都沒有受影響，再試一次就好。'; acts = '<button type="button" class="cb-btn cb-btn--sea" data-act="retry-load">重試</button>' + acts; }
    return '<div class="cabin" data-cabin><header class="cb-top"><button type="button" class="cb-back" data-act="back">' + I('back') + '回海圖</button><h1>船員小屋</h1></header>' +
      '<section class="cb-state" role="' + (kind === 'loading' ? 'status' : 'alert') + '"><h2>' + h + '</h2><p>' + esc(p) + '</p><div class="cb-state__acts">' + acts + '</div></section></div>';
  }

  /* ==========================================================================
     流程與互動
     ========================================================================== */
  const DEFINITE_CLAIM = ['ALREADY_CLAIMED', 'VOUCHER_USED', 'ALREADY_OWNED', 'NOT_IN_POOL', 'TIER_LOCKED', 'VOUCHER_UNAVAILABLE', 'POOL_EMPTY', 'REQUEST_CONFLICT', 'NOT_CANDIDATE', 'TIER_UNKNOWN'];

  /** 還是同一位登入學生、而且還在同一次打開的小屋裡才算數；否則這個非同步結果直接丟掉 */
  function alive(S) { return !!st && S === st && S.owner === RewardLook.who(); }

  /* ---------- 入口與裝備同步（登入期間；海圖顯示時呼叫） ---------- */
  function eligible() {
    try { return typeof GAS_URL === 'string' && GAS_URL.indexOf('http') === 0 && !!RewardLook.who() && !!(AuthSession.student && AuthSession.student.token); }
    catch (e) { return false; }
  }
  function entryVisible() { return ['ok', 'transient', 'session', 'schema', 'error'].indexOf(net.status) >= 0; }
  function syncEntry() {
    const vis = net.owner !== '' && net.owner === RewardLook.who() && entryVisible();
    ['btn-cabin-top', 'btn-cabin-panel'].forEach(function (id) { const b = $(id); if (b) b.hidden = !vis; });
    const p = $('sm-panel'); if (p) p.classList.toggle('has-cabin', vis);
  }
  function resetNet(owner) { net.owner = owner; net.status = 'idle'; net.inv = null; net.lastTry = 0; net.busy = false; net.last = null; }
  function statusOf(r) {
    if (r.kind === 'ok') return 'ok';
    if (r.kind === 'off') return 'off';
    if (r.kind === 'session') return 'session';
    if (r.kind === 'schema') return 'schema';
    if (r.kind === 'unknown') return 'transient';
    return 'error';
  }
  /** 讀取結果 → 入口狀態＋本人外觀。owner 是「發出請求當下」的身分；回來時登入的人換了就丟掉 */
  function applyRead(owner, r) {
    if (owner !== RewardLook.who()) return false;
    net.status = statusOf(r); net.last = r;
    if (r.kind === 'ok') {
      net.inv = r.data;
      const cl = cloudOf(r.data);
      RewardLook.set(owner, cl.equip, cl.hair, cl.version);
    } else if (r.kind === 'off') { net.inv = null; RewardLook.clear(); }
    return true;
  }
  async function ensure(force) {
    const owner = RewardLook.who();
    if (!owner || !eligible()) { resetNet(owner || ''); RewardLook.clear(); syncEntry(); return; }
    if (net.owner !== owner) { resetNet(owner); RewardLook.clear(); }
    if (net.busy) return;
    if (!force && (net.status === 'ok' || net.status === 'off')) { syncEntry(); return; }
    if (!force && net.status !== 'idle' && Date.now() - net.lastTry < 20000) { syncEntry(); return; }
    net.busy = true; net.lastTry = Date.now(); if (net.status === 'idle') net.status = 'loading';
    const r = await CabinNet.inventory();
    net.busy = false;
    if (!applyRead(owner, r)) return;
    syncEntry();
    if (r.kind === 'ok' || r.kind === 'off') RewardLook.repaint();
  }
  /** 海圖每次顯示都會經過這裡（js/map.js 的 updateMap 呼叫）：同步入口；第一次或上次失敗時才去讀 */
  function onMapShown() { syncEntry(); if (!net.busy) ensure(false); }

  /* ---------- 畫面 ---------- */
  let lastDlg = '', returnKey = null;
  function keyOf(el) {
    if (!el || !el.getAttribute || !el.getAttribute('data-act')) return null;
    return { act: el.getAttribute('data-act'), id: el.getAttribute('data-id'), slot: el.getAttribute('data-slot'), k: el.getAttribute('data-k'), i: el.getAttribute('data-i'), tab: el.getAttribute('data-tab'), view: el.getAttribute('data-view') };
  }
  function findKey(k) {
    if (!k || !root) return null;
    const list = root.querySelectorAll('[data-act="' + k.act + '"]');
    for (let n = 0; n < list.length; n++) { const e = list[n], m = keyOf(e); if (m.id === k.id && m.slot === k.slot && m.k === k.k && m.i === k.i && m.tab === k.tab && m.view === k.view) return e; }
    return null;
  }
  function draw() {
    if (!root) return;
    const active = document.activeElement && root.contains(document.activeElement) ? keyOf(document.activeElement) : null;
    const scroller = $('screen-cabin'), top = scroller ? scroller.scrollTop : 0;
    root.innerHTML = st ? html(st) : '';
    if (scroller) scroller.scrollTop = top;
    const dt = st && st.dialog ? st.dialog.t : '';
    if (dt && dt !== lastDlg) {
      returnKey = active || returnKey;
      const b = root.querySelector('.cb-dialog button'); if (b) b.focus();
    } else if (dt) {
      const b = findKey(active) || root.querySelector('.cb-dialog button'); if (b) b.focus();
    } else {
      const e = findKey(active) || (lastDlg ? findKey(returnKey) : null); if (e && !e.disabled) e.focus();
      if (lastDlg) returnKey = null;
    }
    lastDlg = dt;
  }
  function drawState(kind, msg) { st = null; if (root) { root.innerHTML = stateView(kind, msg); const b = root.querySelector('.cb-state button'); if (b) b.focus(); } lastDlg = ''; }
  function toast(S, m) { S.toast = m; draw(); setTimeout(function () { if (alive(S)) { S.toast = null; draw(); } }, 2600); }
  function touch(S, g) { S.save[g] = 'clean'; S.note[g] = null; }

  function equipItem(S, id) {
    const it = C.BY_ID[id], e = S.equip;
    if (it.slot === 'badge') {
      touch(S, 'A');
      if (e.badge1 === id) e.badge1 = null; else if (e.badge2 === id) e.badge2 = null;
      else { const k = slotKeyFor(S, it, e); e[k] = id; }
      return;
    }
    if (e[it.slot] === id) {
      const def = CAT.slots[it.slot].default || null;
      if (def && def !== id) { touch(S, 'A'); e[it.slot] = def; }
      else if (!def) { touch(S, 'A'); e[it.slot] = null; }
      else return toast(S, '起始裝備不能拿掉，換成別的就會自動換下來。');
    } else { touch(S, 'A'); e[it.slot] = id; }
  }

  /* ---------- 領取（二選一／補選券） ---------- */
  function claimedAs(inv, d) {          // 重新查詢的結果裡，這次的領取是不是已經成立
    if (d.via === 'tier') {
      const t = (inv.tiers || []).filter(function (x) { return x.tier_id === C.BY_ID[d.id].tier; })[0];
      return { done: !!t && t.state === 'claimed' && t.chosen_item_id === d.id, other: (t && t.state === 'claimed' && t.chosen_item_id !== d.id) ? t.chosen_item_id : '' };
    }
    const v = (inv.vouchers || []).filter(function (x) { return x.island === islandName(d.island); })[0];
    return { done: !!v && v.status === 'used' && v.chosen_item_id === d.id, other: (v && v.status === 'used' && v.chosen_item_id !== d.id) ? v.chosen_item_id : '' };
  }
  function localPatch(S, d) {            // 領取成功但清單更新失敗時，至少讓畫面和事實一致
    const it = C.BY_ID[d.id]; S.owned[d.id] = true;
    if (d.via === 'tier') S.claims[it.tier] = d.id; else S.vouchers[d.island] = 'used';
    S.poolIds = [];
    C.TIERS.forEach(function (t) { if (S.stars >= t.stars && S.claims[t.id]) t.items.forEach(function (x) { if (!S.owned[x] && S.poolIds.indexOf(x) < 0) S.poolIds.push(x); }); });
  }
  async function claimDone(S, d, recovered) {
    S.panel = null; S.tryOn = null;
    const q = await CabinNet.inventory();
    if (!alive(S)) return;
    let stale = false;
    if (q.kind === 'ok') { applyInv(S, q.data, true); applyRead(S.owner, q); }
    else { localPatch(S, d); stale = true; }
    S.dialog = { t: 'done', id: d.id, via: d.via, island: d.island, rid: d.rid, recovered: !!recovered, listStale: stale };
    draw();
  }
  async function runClaim(S, d) {
    d.rid = d.rid || CabinNet.newRequestId();
    S.dialog = { t: 'working', id: d.id, via: d.via, island: d.island, rid: d.rid }; draw();
    const it = C.BY_ID[d.id];
    const r = d.via === 'tier' ? await CabinNet.claim(it.tier, d.id, d.rid) : await CabinNet.redeem(islandName(d.island), d.id, d.rid);
    if (!alive(S)) return;
    if (r.kind === 'ok') return claimDone(S, d, false);
    if (r.kind === 'unknown') return recheck(S, d);
    if (r.kind === 'off') { S.dialog = { t: 'error', title: '功能目前沒有開放', msg: '獎勵功能現在沒有開放，所以這次沒有領取。你的星星和進度都沒有受影響。' }; return draw(); }
    if (r.kind === 'session') { S.dialog = { t: 'error', title: '登入需要更新', msg: r.message || '登入已經過期了，請回到首頁重新登入。這次沒有領取。' }; return draw(); }
    /* 伺服器明確拒絕（沒有寫入）：把理由原樣告訴學生，並把清單更新成真正的樣子 */
    S.dialog = { t: 'error', title: '這次沒有領取', msg: (r.message || '伺服器沒有接受這次領取。') + '（不會扣星星。）' }; draw();
    const q = await CabinNet.inventory();
    if (alive(S) && q.kind === 'ok') { applyInv(S, q.data, true); applyRead(S.owner, q); S.panel = null; S.tryOn = null; draw(); }
  }
  async function recheck(S, d) {
    S.dialog = { t: 'unsure', id: d.id, via: d.via, island: d.island, rid: d.rid }; draw();
    const q = await CabinNet.inventory();
    if (!alive(S)) return;
    if (q.kind !== 'ok') { S.dialog = { t: 'unsure2', id: d.id, via: d.via, island: d.island, rid: d.rid }; return draw(); }
    const res = claimedAs(q.data, d);
    if (res.done) { applyInv(S, q.data, true); applyRead(S.owner, q); S.panel = null; S.tryOn = null; S.dialog = { t: 'done', id: d.id, via: d.via, island: d.island, rid: d.rid, recovered: true }; return draw(); }
    applyInv(S, q.data, true); applyRead(S.owner, q);
    if (res.other) { S.panel = null; S.tryOn = null; S.dialog = { t: 'error', title: '這一組已經領過了', msg: '雲端查到這一組已經選了「' + (C.BY_ID[res.other] || { name: res.other }).name + '」，這次沒有再領。' }; return draw(); }
    S.dialog = { t: 'retry', id: d.id, via: d.via, island: d.island, rid: d.rid }; draw();
  }

  /* ---------- 儲存 ---------- */
  function payloadA(S) {
    const slots = {}; SLOT_ORDER.forEach(function (k) { slots[k] = S.equip[k] || null; });
    return { v: 1, slots: slots, appearance: { hair_color: S.hair || null } };
  }
  function failNote(r) {
    if (r.kind === 'off') return '獎勵功能現在沒有開放，這次沒有儲存。';
    return (r.message || '伺服器沒有接受這次儲存。') + '（草稿還在，可以修改後再存。）';
  }
  async function saveA(S) {
    const sent = { equip: clone(S.equip), hair: S.hair };
    const r = await CabinNet.saveEquipped(payloadA(S), S.cloud.version);
    if (!alive(S)) return;
    if (r.kind === 'ok') {
      const cl = cloudOf(r.data);
      setCloud(S, cl, false);
      if (groupJSON('A', sent) !== groupJSON('A', S)) { /* 儲存途中沒有編輯（編輯被擋住），理論上不會發生 */ }
      S.save.A = 'saved'; S.note.A = null;
      if (RewardLook.set(S.owner, cl.equip, cl.hair, cl.version)) RewardLook.repaint();
      return;
    }
    if (r.kind === 'unknown') { S.save.A = 'unknown'; S.note.A = null; return; }
    if (r.kind === 'denied' && r.code === 'VERSION_CONFLICT' && r.data && r.data.current) {
      const cl = cloudOf(r.data.current);
      setCloud(S, cl, true);
      S.save.A = 'clean';
      S.note.A = '目前雲端內容與這份草稿不同（可能在別的裝置改過）。你的草稿還在：確認後可以按「儲存」，或按「還原」改用雲端內容。';
      if (RewardLook.set(S.owner, cl.equip, cl.hair, cl.version)) RewardLook.repaint();
      return;
    }
    if (r.kind === 'off') { S.save.A = 'failed'; S.note.A = failNote(r); net.status = 'off'; return; }
    S.save.A = 'failed'; S.note.A = failNote(r);
  }
  async function saveB(S) {
    const a = AvatarKit.parse(S.avatar), idx = uniIdx(S), code = AvatarKit.encode({ c: a.c, col: idx, b: a.b });
    const r = await CabinNet.saveUniform(code);
    if (!alive(S)) return;
    if (r.kind === 'ok') {
      if (currentUser && currentUser.progress) currentUser.progress.avatar = code;
      S.avatar = code; S.uniform = null; S.saved.uniform = null; S.save.B = 'saved'; S.note.B = null;
      RewardLook.repaint();
      return;
    }
    if (r.kind === 'unknown') { S.save.B = 'unknown'; S.note.B = null; return; }
    S.save.B = 'failed'; S.note.B = failNote(r);
  }
  async function runSave(S) {
    const gs = ['A', 'B'].filter(function (g) { return dirtyLike(S, g); });
    if (!gs.length) return;
    gs.forEach(function (g) { S.save[g] = 'saving'; S.note[g] = null; }); draw();
    await Promise.all(gs.map(function (g) { return g === 'A' ? saveA(S) : saveB(S); }));
    if (!alive(S)) return;
    draw();
  }
  async function runRequery(S) {
    const gs = ['A', 'B'].filter(function (g) { return effState(S, g) === 'unknown'; });
    gs.forEach(function (g) { S.save[g] = 'checking'; }); draw();
    const jobs = gs.map(async function (g) {
      if (g === 'B') return saveB(S);                       // 制服色沒有唯讀查詢：同一個顏色再存一次（重複存同一個值沒有副作用）
      const q = await CabinNet.inventory();
      if (!alive(S)) return;
      if (q.kind !== 'ok') { S.save.A = 'unknown'; S.note.A = '還是連不上，請稍後再按一次「重新查詢」。'; return; }
      const cl = cloudOf(q.data), draft = { equip: S.equip, hair: S.hair };
      applyInv(S, q.data, true); applyRead(S.owner, q);
      if (groupJSON('A', draft) === groupJSON('A', { equip: cl.equip, hair: cl.hair })) { S.save.A = 'saved'; S.note.A = null; RewardLook.repaint(); }
      else { S.save.A = 'clean'; S.note.A = '目前雲端內容與這份草稿不同。你的草稿還在：確認後可以按「儲存」，或按「還原」改用雲端內容。'; RewardLook.repaint(); }
    });
    await Promise.all(jobs);
    if (!alive(S)) return;
    draw();
  }

  /* ---------- 離開 ---------- */
  function leave() {
    st = null; lastDlg = ''; returnKey = null; load.token = null;
    switchScreen('screen-map');
    try { RewardLook.repaint(); } catch (e) { /* 重畫失敗不影響離開 */ }
    syncEntry();
  }
  function needsLeaveCheck(S) { return ['A', 'B'].some(function (g) { const v = effState(S, g); return v !== 'clean' && v !== 'saved'; }); }

  /* ---------- 點擊 ---------- */
  function onClick(ev) {
    const el = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el || !root.contains(el) || el.disabled) return;
    const act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (act === 'retry-load') { load(); return; }
    if (!st) { if (act === 'back') leave(); return; }
    const S = st;
    if (busy(S) && act !== 'noop') return;                  // 儲存中先不接受其他操作（避免草稿在送出途中被改）
    if (act === 'back') { if (needsLeaveCheck(S)) S.dialog = { t: 'leave' }; else return leave(); }
    else if (act === 'leave-save') { S.dialog = null; draw(); runSave(S).then(function () { if (alive(S) && !needsLeaveCheck(S)) leave(); }); return; }
    else if (act === 'leave-drop') { S.dialog = null; return leave(); }
    else if (act === 'view') { S.view = el.getAttribute('data-view'); S.slotFilter = null; }
    else if (act === 'tab') { S.tab = el.getAttribute('data-tab'); S.slotFilter = null; }
    else if (act === 'slot') { const k = el.getAttribute('data-slot'); S.slotFilter = S.slotFilter === k ? null : k; S.view = 'items'; }
    else if (act === 'slot-clear') S.slotFilter = null;
    else if (act === 'uni') { const a = AvatarKit.parse(S.avatar); if (a.legacy) return; touch(S, 'B'); const i = +el.getAttribute('data-i'); S.uniform = (i === a.col) ? null : i; }
    else if (act === 'hair') { touch(S, 'A'); const k = el.getAttribute('data-k'); S.hair = k ? k : null; }
    else if (act === 'hatoff') S.hatOff = !hatOffNow(S) ? true : false;
    else if (act === 'item') {
      const s = status(S, id), it = C.BY_ID[id];
      if (s.k === 'equipped' || s.k === 'owned') { equipItem(S, id); S.tryOn = null; }
      else if (s.k === 'claimable') { S.panel = { t: 'pair', tier: it.tier }; S.tryOn = null; }
      else if (s.k === 'pool') { S.panel = { t: 'voucher' }; S.tryOn = id; S.vpick = S.vpick || (vAvail(S)[0] && vAvail(S)[0].k); }
      else { S.tryOn = S.tryOn === id ? null : id; }
    }
    else if (act === 'try') S.tryOn = S.tryOn === id ? null : id;
    else if (act === 'choose') { const via = el.getAttribute('data-via'); if (via === 'voucher') S.vpick = S.vpick || (vAvail(S)[0] && vAvail(S)[0].k); S.dialog = { t: 'confirm', id: id, via: via, island: S.vpick }; }
    else if (act === 'close-panel') { S.panel = null; S.tryOn = null; }
    else if (act === 'open-voucher') { S.panel = { t: 'voucher' }; S.vpick = vAvail(S)[0] && vAvail(S)[0].k; }
    else if (act === 'vsel') { S.vpick = el.getAttribute('data-k'); S.dialog.island = S.vpick; }
    else if (act === 'dlg-cancel') S.dialog = null;
    else if (act === 'dlg-ok') { const d = S.dialog; runClaim(S, { id: d.id, via: d.via, island: d.via === 'voucher' ? (S.vpick || d.island) : null }); return; }
    else if (act === 'dlg-retry') { const d = S.dialog; runClaim(S, { id: d.id, via: d.via, island: d.island, rid: d.rid }); return; }
    else if (act === 'dlg-recheck') { const d = S.dialog; recheck(S, d); return; }
    else if (act === 'dlg-later') S.dialog = null;
    else if (act === 'dlg-equip') { equipItem(S, S.dialog.id); S.dialog = null; }
    else if (act === 'save') { runSave(S); return; }
    else if (act === 'revert') { S.equip = clone(S.saved.equip); S.hair = S.saved.hair; S.uniform = S.saved.uniform; S.save = { A: 'clean', B: 'clean' }; S.note = { A: null, B: null }; }
    else if (act === 'requery') { runRequery(S); return; }
    draw();
  }
  function onKey(ev) {
    if (!st || !st.dialog) return;
    const t = st.dialog.t;
    if (ev.key === 'Escape' && ['confirm', 'leave', 'retry', 'unsure2', 'error', 'done'].indexOf(t) >= 0) { ev.preventDefault(); st.dialog = null; draw(); return; }
    if (ev.key === 'Tab') {                                  // 對話框開著時，Tab 只在對話框裡轉圈
      const f = root.querySelectorAll('.cb-dialog button:not([disabled])'); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  }

  /* ---------- 打開小屋 ---------- */
  async function load() {
    const owner = RewardLook.who(); if (!owner || !eligible()) { drawState('session', '請先登入。'); return; }
    if (net.owner !== owner) { resetNet(owner); }
    drawState('loading');
    const mine = {};                                           // 這次打開的識別（離開再打開的話，舊的結果不算數）
    load.token = mine;
    const r = await CabinNet.inventory();
    if (load.token !== mine || owner !== RewardLook.who()) return;
    applyRead(owner, r); syncEntry();
    if (r.kind === 'ok') {
      st = makeState(owner, r.data); lastDlg = ''; draw();
      RewardLook.repaint();
      return;
    }
    if (r.kind === 'off') return drawState('off');
    if (r.kind === 'session') return drawState('session', r.message);
    if (r.kind === 'schema') return drawState('schema');
    if (r.kind === 'unknown') return drawState('transient');
    drawState('error', r.message);
  }
  function open() {
    if (!eligible()) return;
    root = $('cabin-root'); if (!root) return;
    if (!root.__cbBound) { root.addEventListener('click', onClick); root.addEventListener('keydown', onKey); root.__cbBound = true; }
    st = null; lastDlg = ''; returnKey = null;
    switchScreen('screen-cabin');
    load();
  }

  /** 測試用（唯讀）：目前的入口狀態與小屋狀態摘要 */
  function debug() {
    return { net: { owner: net.owner, status: net.status, busy: net.busy }, open: !!st, save: st ? Object.assign({}, st.save) : null, dialog: st && st.dialog ? st.dialog.t : null,
      draft: st ? { equip: clone(st.equip), hair: st.hair, uniform: st.uniform } : null, cloud: st ? clone(st.cloud) : null };
  }
  return { open: open, onMapShown: onMapShown, ensure: ensure, syncEntry: syncEntry, debug: debug };
})();
