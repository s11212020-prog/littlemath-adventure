/* ==========================================================================
   階段 8.1：新手航海導覽（Coach Mark／Spotlight）
   9F-3a tourfix2.2：改成「章節式」導覽——首次必要導覽＋可重看的「玩法指南」章節選單＋舊帳號的新功能提示
   - 純前端顯示層：只「讀」目前進度與畫面上的入口按鈕；不呼叫任何 API（零後端請求）、不改 currentUser.progress／total_stars、
     不新增紀錄、不解鎖區域、不點亮燈塔、不加入班級、不變更密碼、不領獎勵、不送出答案。
     導覽不會真的打開「我的帳號」「班級」「船員小屋」；只高亮入口按鈕，並用「操作順序」文字與不可操作的簡易示意圖說明。
   - 「看過」只記在這台裝置的 localStorage，完全不寫 Google Sheet：
       舊鍵（8.1，不刪不改）  mathIslandTutorial:v1:<學生識別值> = "1"        → 視為已看過必要導覽
       新鍵（2.2）            mathIslandTutorial:v2:<學生識別值>:<代碼> = "1"  → 代碼：core（必要導覽）、account、class、tasks、cabin、…（新功能）
     學生識別值：有 user_id 就只用 user_id；沒有（舊帳號）才用 username。紀錄只存這台裝置，換裝置會重新提示一次。
   - 自動出現：總星數 0、沒有任何學習紀錄、本裝置沒看過、已選好船員並進入海圖。已有星星／紀錄的學生不會被強制播放。
   - 9F-3a 導覽修正：只有成功啟動才算用掉這次自動檢查；條件還沒好時最多重試約 1 秒（10 次 × 100ms，不留計時器）；登出、離開海圖、換學生都會取消。
   - 步驟依畫面上「實際存在的入口按鈕」動態組成：班級、任務、船員小屋、我的帳號沒有開放（按鈕沒有出現）就整步略過，不留空白步驟、不會卡住。
   - 「玩法指南」按鈕：開啟章節選單（可單獨重看任一章，或播放完整導覽）；重看不改看過紀錄。
   - 舊帳號（已看過舊導覽）遇到導覽沒介紹過的功能時，只在進入海圖約 2 秒後跳出「一則」合併的簡短提示；之後不再自動出現。
   - 以後新增學生功能（例如隨堂測驗），用 Tutorial.registerChapter() 登記成新章節，不必改這個檔。
   - 亮框位置全部用 getBoundingClientRect() 即時計算（視窗改變、旋轉、捲動、海圖滑動、縮放、安全區變動都會重算），沒有寫死座標。
   - 導覽用的「示範港口」只是把真正的港口視窗打開來看（唯讀）；結束或跳過一定會關閉，並把 selectedIslandForModal 還原。
   ========================================================================== */
const Tutorial = (function () {
  'use strict';
  const VERSION = 'v1';
  const KEY_PREFIX = 'mathIslandTutorial:' + VERSION + ':';
  const KEY2_PREFIX = 'mathIslandTutorial:v2:';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const ic = function (name, size) { try { return UIKit.icon(name, { size: size || 24 }); } catch (e) { return ''; } };

  const OPENING = '小船員，歡迎來到六島大冒險！跟著航海指南看看怎麼開始吧！';
  /* 規則數字（3／5／10 題；70%／90%／20%；9／54 顆星）和 js/questions.js 的實際規則一致，測試會比對原始碼 */
  const ISLAND_NAMES = ['加法島', '減法島', '乘法島', '除法島', '應用題島', '四則運算島'];

  /* ---------- 海圖上的入口按鈕（只「讀」它們有沒有出現；直式手機把部分按鈕收進「更多」） ---------- */
  function visible(el) { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function btnAvail(id) { const e = $(id); return !!(e && !e.hidden); }            /* 後端功能沒開、示範模式：按鈕保持 hidden → 視為沒有這個功能 */
  function cabinAvail() { return btnAvail('btn-cabin-top') || btnAvail('btn-cabin-panel'); }
  function inActiveClass() {                                                      /* 已「正式加入」班級（同意分享）才有老師任務；只讀 StudentClass 的狀態，不呼叫後端 */
    try { const m = StudentClass._state.info.membership; return !!(m && m.status === 'active'); } catch (e) { return false; }
  }
  function entryTarget(ids) {                                                     /* 入口按鈕看得到就框它；被收進「更多」就框「更多」；都沒有回傳 null */
    for (let i = 0; i < ids.length; i++) { const e = $(ids[i]); if (visible(e)) return e; }
    const m = $('btn-more'); return visible(m) ? m : null;
  }
  function viaMore(ids) { return !ids.some(function (id) { return visible($(id)); }) && visible($('btn-more')); }
  function moreNote(ids, what) { return viaMore(ids) ? '<p class="tt-main">' + esc(what) + '收在畫面下方的「更多」裡面。</p>' : ''; }

  /* ---------- 小型示意圖（不可操作、不含任何個資、不呼叫後端；螢幕閱讀器改讀下方的文字清單） ---------- */
  function flowHTML(chips) {
    return '<div class="tt-flow" aria-hidden="true">' + chips.map(function (t, i) {
      return (i ? '<span class="tt-flow__go">' + ic('next', 18) + '</span>' : '') + '<span class="tt-flow__chip"><i>' + (i + 1) + '</i>' + esc(t) + '</span>';
    }).join('') + '</div>';
  }
  function orderHTML(chips, steps, note) {
    return flowHTML(chips) + '<ol class="tt-order">' + steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' + (note ? '<p class="tt-note">' + esc(note) + '</p>' : '');
  }
  function demoHTML() {
    return '<div class="tt-demo" aria-hidden="true"><div class="tt-demo__stage">' + ic('story', 34) + '<span>動畫＋字幕</span></div><span class="tt-demo__go">' + ic('next', 26) + '</span>' +
      '<div class="tt-demo__q"><b>5 ＋ 3 ＝ ？</b><span class="tt-demo__box">？</span><span class="tt-demo__hint">' + ic('hint', 22) + '提示 1</span></div></div>';
  }
  function routeListHTML() {
    const L = (typeof ProgressSystem !== 'undefined' && ProgressSystem.TITLE_LEVELS) || [];
    return '<ol class="tt-route">' + L.map(function (x) { return '<li><b>' + x.min + ' 星</b><span>' + esc(x.title) + '</span></li>'; }).join('') + '</ol>';
  }
  function unionOf(els) {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, n = 0;
    els.forEach(function (e) { if (!visible(e)) return; const q = e.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); n++; });
    return n ? { el: els.filter(visible)[0], rect: toRect({ left: l, top: t, right: r, bottom: b }) } : null;
  }
  function toRect(r) { return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.right - r.left, height: r.bottom - r.top }; }
  function rectOfAll(sel) { return unionOf(Array.prototype.slice.call(document.querySelectorAll(sel))); }
  function statOf(id) { const e = $(id); return e && e.closest ? e.closest('.sm-stat') : null; }

  /* ---------- 章節（「玩法指南」選單的項目）。order 小的在前；registerChapter 可以再加 ---------- */
  const CHAPTERS = [
    { id: 'map', order: 1, title: '海圖與三區關卡', sub: '選島、三個學習區、先理解再練習', icon: 'map' },
    { id: 'stars', order: 2, title: '星星、燈塔與稱號', sub: '收集星星、點亮燈塔、提升稱號', icon: 'lighthouse' },
    { id: 'account', order: 3, title: '帳號與密碼', sub: '顯示名稱、變更密碼、忘記密碼', icon: 'crew' },
    { id: 'class', order: 4, title: '班級與資料分享', sub: '加入班級是選填；老師能看什麼由你決定', icon: 'teacher' },
    { id: 'tasks', order: 5, title: '任務與學習紀錄', sub: '老師任務、冒險日誌', icon: 'book' },
    { id: 'cabin', order: 6, title: '獎勵、船員小屋與裝備', sub: '寶箱二選一、物品收藏、裝備欄', icon: 'crew' }
  ];
  function chapterOf(id) { return CHAPTERS.filter(function (c) { return c.id === id; })[0] || null; }

  /* ---------- 新功能代碼（舊帳號的「新功能提示」用）：available() 為真，而且這台裝置沒提示過，才會被提示 ---------- */
  const FEATURES = [
    { code: 'account', chapter: 'account', available: function () { return btnAvail('btn-account'); } },
    { code: 'class', chapter: 'class', available: function () { return btnAvail('btn-class'); } },
    { code: 'tasks', chapter: 'tasks', available: function () { return btnAvail('btn-class') && inActiveClass(); } },
    { code: 'cabin', chapter: 'cabin', available: cabinAvail }
  ];

  /* ---------- 步驟（文字依規格；target 用函式即時取得真實畫面上的元素；when() 為假就整步略過） ----------
     core：首次必要導覽（與「播放完整導覽」）會播；沒有 core 的步驟只在該章節重看時播。
     skipIfMissing：開始時入口按鈕在，但換到這步時找不到目標 → 這步直接略過（不顯示空白卡片、不卡住）。 */
  const STEPS = [
    { id: 'welcome', chapter: 'map', core: true, title: '歡迎來到六島大冒險！', lead: OPENING,
      main: '你可以自由選擇想挑戰的數學島。完成各區任務，收集星星、點亮燈塔，提升你的航海稱號！', target: null },
    { id: 'island', chapter: 'map', core: true, title: '選一座島出發', main: '點擊島嶼，小船就會帶你前往島上的挑戰港口。六座島都可以自由選擇！',
      more: { label: '詳細說明', html: function () { return '<ul class="tt-chips">' + ISLAND_NAMES.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'; } },
      target: function () { return $('node-add'); }, interactive: true, map: true },
    { id: 'zones', chapter: 'map', core: true, title: '一座島有三個學習區', main: '請依序完成「概念學習、互動練習、掌握確認」。前一區過關，下一區才會開放。',
      extra: function () { return '<ul class="tt-zones"><li><b>概念學習區</b><span>先看概念動畫，再完成 3 題。</span></li><li><b>互動練習區</b><span>完成學習區後開放，共 5 題。</span></li><li><b>掌握確認區</b><span>完成練習區後開放，共 10 題。</span></li></ul>'; },
      more: { label: '詳細說明', html: function () { return '<ul class="tt-list"><li>學習區隨時可以進入。</li><li>學習區至少得到 1 顆星，才開放互動練習區。</li><li>互動練習區至少得到 1 顆星，才開放掌握確認區。</li><li>不用拿到 3 顆星才能前進。</li></ul>'; } },
      target: function () { return rectOfAll('#modal-actions .zp-zone'); }, port: true },
    { id: 'learn', chapter: 'map', core: true, title: '先理解，再練習', main: '進入概念學習區後，先看動畫和字幕，再開始回答問題。',
      main2: '第一次答錯不用擔心，系統會一步一步提供提示。訂正正確後，才能進入下一題。',
      extra: function () { return demoHTML(); },
      more: { label: '詳細說明', html: function () { return '<ul class="tt-list"><li>第一次答錯：提示 1。</li><li>再次答錯：提示 2。</li><li>再次答錯：提示 3。</li><li>一定要完成訂正，不能直接跳過題目。</li><li>電腦可以使用 Enter 送出答案或進入下一題。</li></ul>'; } },
      target: function () { return document.querySelector('#modal-actions .zp-zone[data-zone="LEARNING"]'); }, port: true },
    { id: 'stars', chapter: 'stars', core: true, title: '完成挑戰，收集星星', main: '每完成一個區域，至少可以獲得 1 顆星。第一次答對越多、使用提示越少，就有機會得到 2 顆或 3 顆星！',
      more: { label: '查看詳細規則', html: function () { return '<ul class="tt-list"><li>完成全部題目並完成訂正：1 顆星。</li><li>首次答對率至少 70%：2 顆星。</li><li>首次答對率至少 90%，提示使用率不超過 20%：3 顆星。</li><li>每區最多 3 顆，每島最多 9 顆，六島最多 54 顆。</li><li>重玩成績較差，不會扣掉原本最高的星數。</li></ul>'; } },
      target: function () { return statOf('stars-add'); }, map: true },
    { id: 'lighthouse', chapter: 'stars', core: true, title: '完成一區，點亮一盞燈', main: '一個區域過關，就會點亮一盞燈。三個區域都過關，整座島的三盞燈就會全部亮起！',
      more: { label: '詳細說明', html: function () { return '<ul class="tt-list"><li>概念學習區過關：第一盞燈。</li><li>互動練習區過關：第二盞燈。</li><li>掌握確認區過關：第三盞燈。</li><li>一座島收集到 9 顆星時，會出現最高榮譽效果。</li></ul>'; } },
      target: function () { return unionOf([$('lh-add'), statOf('lhc-add')]); }, map: true },
    { id: 'title', chapter: 'stars', core: true, title: '星星越多，稱號越高', main: '收集總星星可以提升航海稱號。點擊這裡，就能查看現在的位置和所有未來稱號！',
      more: { label: '稱號路線', open: 'wide', html: function () { return routeListHTML(); } },
      button: { id: 'tt-open-route', label: '查看完整稱號航線', icon: 'map' },
      target: function () { return $('btn-title-route'); }, interactive: true, map: true },
    { id: 'journal', chapter: 'tasks', core: true, title: '到冒險日誌看看成長', main: '完成挑戰後，可以在冒險日誌查看各島各區的完成時間、答對率和獲得星星。',
      extra: function () { return moreNote(['btn-history'], '冒險日誌'); },
      more: { label: '操作順序', open: 'order', html: function () { return orderHTML(['冒險日誌', '各島星星', '燈塔與完成狀態', '學習紀錄'],
        ['點「冒險日誌」。', '查看每一座島的星星與燈塔。', '查看每個區域的完成狀態。', '查看學習紀錄：完成時間、答對率和獲得的星星。'], '這裡只是查看，不會改變你的星星和進度。'); } },
      target: function () { return entryTarget(['btn-history']); }, map: true },
    { id: 'account', chapter: 'account', core: true, feature: 'account', skipIfMissing: true, title: '我的帳號：看名稱、改密碼', main: '在「我的帳號」可以看到自己的顯示名稱，也能變更密碼。需要的時候，還可以自己建立「密碼重設碼」。',
      extra: function () { return moreNote(['btn-account'], '我的帳號'); },
      more: { label: '操作順序', open: 'order', html: function () { return orderHTML(['我的帳號', '顯示名稱', '變更密碼', '密碼重設碼'],
        ['點「我的帳號」。', '可以查看顯示名稱。', '可以變更密碼（要先輸入目前的密碼）。', '有需要時，可以建立「密碼重設碼」，忘記密碼時用它重設。'], '導覽不會真的打開這一頁，也不會顯示任何密碼。密碼重設碼只會顯示一次，請自己抄好收好，不要告訴別人。'); } },
      when: function () { return btnAvail('btn-account'); }, target: function () { return entryTarget(['btn-account']); }, map: true },
    { id: 'account-forgot', chapter: 'account', feature: 'account', skipIfMissing: true, title: '忘記密碼怎麼辦？', main: '在登入畫面按「忘記密碼？」，輸入帳號和密碼重設碼，就能設定新的密碼。',
      extra: function () { return moreNote(['btn-account'], '我的帳號'); },
      more: { label: '操作順序', open: 'order', html: function () { return orderHTML(['登出', '忘記密碼？', '帳號＋重設碼', '設定新密碼'],
        ['先登出，回到登入畫面。', '按「忘記密碼？」。', '輸入帳號和密碼重設碼。', '設定新的密碼，再輸入一次，按「重設密碼」。'], '沒有密碼重設碼的話，請告訴老師或管理員，他們會幫你重設。'); } },
      when: function () { return btnAvail('btn-account'); }, target: function () { return entryTarget(['btn-account']); }, map: true },
    { id: 'class', chapter: 'class', core: true, feature: 'class', skipIfMissing: true, title: '班級：選填，不加入也能玩', main: '想跟著老師的班級一起學，可以輸入老師給的班級代碼加入。不加入班級，也能自己完整遊玩六座島。',
      extra: function () { return moreNote(['btn-class'], '班級'); },
      more: { label: '操作順序', open: 'order', html: function () { return orderHTML(['加入班級', '班級代碼', '資料分享範圍', '勾選同意', '正式加入'],
        ['點「加入班級（選填）」。', '輸入老師提供的班級代碼，按「查看這個班級」。', '閱讀資料分享範圍。', '勾選「我看完上面的說明了，同意加入」，按「確認加入」。', '老師當面確認你是本人後，再由你按「同意分享，正式加入」。'],
        '不想加入也沒關係：隨時可以按「稍後再說，自己冒險」。導覽不會真的加入任何班級。'); } },
      when: function () { return btnAvail('btn-class'); }, target: function () { return entryTarget(['btn-class']); }, map: true },
    { id: 'class-share', chapter: 'class', feature: 'class', skipIfMissing: true, title: '老師能看到什麼，由你決定', main: '在你同意分享之前，老師只看得到你的顯示名稱、稱號和帳號識別後四碼。',
      extra: function () { return moreNote(['btn-class'], '班級'); },
      more: { label: '詳細說明', open: 'order', html: function () { return '<ul class="tt-list"><li>正式加入並同意分享後，老師可以看到你的學習進度與作答情形。</li><li>加入前，畫面上會寫清楚分享的範圍，看完再決定。</li><li>你隨時可以離開班級，離開後星星、獎勵、裝扮和學習紀錄都還在。</li></ul>'; } },
      when: function () { return btnAvail('btn-class'); }, target: function () { return entryTarget(['btn-class']); }, map: true },
    { id: 'class-leave', chapter: 'class', feature: 'class', skipIfMissing: true, title: '想離開班級也可以', main: '已經加入班級的話，可以在「我的班級」按「離開班級」。離開後可以繼續自己冒險。',
      extra: function () { return moreNote(['btn-class'], '班級'); },
      more: { label: '操作順序', open: 'order', html: function () { return orderHTML(['我的班級', '離開班級', '繼續冒險'],
        ['點「我的班級」。', '按「離開班級」。', '回到海圖，繼續自己冒險。'], '離開後，你的星星、獎勵、裝扮和學習紀錄都還在。'); } },
      when: function () { return btnAvail('btn-class'); }, target: function () { return entryTarget(['btn-class']); }, map: true },
    { id: 'tasks', chapter: 'tasks', core: true, feature: 'tasks', skipIfMissing: true, title: '老師任務在「我的班級」', main: '加入班級後，老師發布的任務會在「我的班級」裡。任務不會鎖住任何島嶼，其他島和區域都可以照常玩。',
      extra: function () { return moreNote(['btn-class'], '我的班級'); },
      more: { label: '操作順序', open: 'order', html: function () { return orderHTML(['我的班級', '查看老師任務', '開始或繼續', '查看狀態'],
        ['點「我的班級」。', '按「查看老師任務」。', '選一個任務，開始或繼續練習。', '完成後回到任務清單，查看完成狀態。'], '完成狀態是依你的練習紀錄整理的。導覽不會真的開始任何任務。'); } },
      when: function () { return btnAvail('btn-class') && inActiveClass(); }, target: function () { return entryTarget(['btn-class']); }, map: true },
    { id: 'cabin', chapter: 'cabin', core: true, feature: 'cabin', skipIfMissing: true, title: '船員小屋：領獎勵、換裝備', main: '收集到足夠的星星，船員小屋的寶箱就會打開。每個寶箱二選一，選好的物品會放進你的收藏。',
      more: { label: '操作順序', open: 'order', html: function () { return orderHTML(['進入小屋', '可領的寶箱', '二選一', '物品收藏', '裝備欄'],
        ['進入「船員小屋」。', '查看可以領取的寶箱。', '從兩件獎勵中二選一。', '到「物品收藏」查看已經擁有和還沒解鎖的物品。', '把物品放進對應的裝備欄，按「儲存」。'], '星星只是解鎖條件：領取和裝備都不會扣星星，也不影響稱號。導覽不會真的領取任何獎勵。'); } },
      when: cabinAvail, target: function () { return entryTarget(['btn-cabin-top', 'btn-cabin-panel']); }, map: true },
    { id: 'cabin-equip', chapter: 'cabin', feature: 'cabin', skipIfMissing: true, title: '物品與裝備怎麼用', main: '放進收藏的物品，可以先「試戴」看看，滿意再放進對應的裝備欄，最後按「儲存」。',
      more: { label: '詳細說明', open: 'order', html: function () { return '<ul class="tt-list"><li>裝備欄有：徽章、頭上、手上，以及船的救生圈、船旗、船首像、船身。</li><li>還沒解鎖的物品會顯示需要幾顆星。</li><li>試戴只是看看，不會領取，也不會儲存。</li><li>按「儲存」之後，裝備才會被記住。</li></ul>'; } },
      when: cabinAvail, target: function () { return entryTarget(['btn-cabin-top', 'btn-cabin-panel']); }, map: true },
    { id: 'guide', chapter: null, core: true, title: '隨時可以重看玩法指南', main: '之後想再看說明，按「玩法指南」，可以挑一章重看，也可以重新看完整導覽。',
      extra: function () { return moreNote(['btn-guide'], '玩法指南'); },
      more: { label: '有哪些章節', html: function () { return '<ul class="tt-list">' + availableChapters().map(function (c) { return '<li>' + esc(c.title) + '</li>'; }).join('') + '</ul>'; } },
      closing: '準備好了嗎？選一座島開始冒險吧！',
      target: function () { return entryTarget(['btn-guide']); }, map: true }
  ];

  const S = { active: false, step: 0, steps: [], chapter: null, mode: 'auto', trigger: null, demoPort: false, prevSelected: '', prevIsland: null, autoFor: null, pend: null, why: '', raf: false, layoutMode: '', root: null, bound: false, cur: null, hintTimer: 0, hinted: {}, hasTarget: false, dropped: {}, shown: {}, prevScroll: 0 };

  /* 依「目前畫面真的有的功能」組出這次要播的步驟：chapterId 為空 → 首次必要導覽（core）；否則只播那一章 */
  function compose(chapterId) {
    return STEPS.filter(function (s) {
      if (chapterId ? s.chapter !== chapterId : !s.core) return false;
      try { return !s.when || !!s.when(); } catch (e) { return false; }
    });
  }
  function availableChapters() {
    return CHAPTERS.slice().sort(function (a, b) { return a.order - b.order; }).filter(function (c) { return compose(c.id).length > 0; });
  }
  /* 以後新增學生功能時登記新章節：{ id, title, sub, icon, order, feature:{code, available()}, steps:[{id,title,main,more,target,when,core,...}] } */
  function registerChapter(def) {
    if (!def || !def.id || !def.title || !Array.isArray(def.steps) || !def.steps.length) return false;
    if (chapterOf(def.id)) return false;
    CHAPTERS.push({ id: def.id, order: def.order || (100 + CHAPTERS.length), title: def.title, sub: def.sub || '', icon: def.icon || 'compass' });
    if (def.feature && def.feature.code && typeof def.feature.available === 'function') FEATURES.push({ code: def.feature.code, chapter: def.id, available: def.feature.available });
    def.steps.forEach(function (s) {
      const step = Object.assign({ skipIfMissing: true }, s, { chapter: def.id, feature: def.feature && def.feature.code ? def.feature.code : s.feature });
      const g = STEPS.map(function (x) { return x.id; }).indexOf('guide');
      if (step.core && g >= 0) STEPS.splice(g, 0, step); else STEPS.push(step);   /* 要放進必要導覽的步驟排在「玩法指南」那一步前面 */
    });
    return true;
  }

  /* ---------- 看過紀錄（只用 localStorage；失敗就當成沒看過，不影響使用） ---------- */
  function ids() {
    /* 9F-3a 導覽修正：有 user_id 就只用 user_id（新帳號即使登入代碼和以前用過的相同，user_id 不同就是不同學生）；
       只有舊帳號確實沒有 user_id 時，才用 username 當備援。不刪除、不改寫任何既有的 localStorage 紀錄。 */
    const u = currentUser || {};
    if (u.user_id && u.id_status !== 'temporary') return [String(u.user_id)];   /* 示範／離線模式的臨時編號（TMP_）每次登入都不同，不能當紀錄鍵：這種情況改用 username */
    if (u.username) return [String(u.username)];
    return [];
  }
  function keyFor(id) { return KEY_PREFIX + id; }
  function key2For(id, code) { return KEY2_PREFIX + id + ':' + code; }
  function seenV2(code) { try { return ids().some(function (id) { return localStorage.getItem(key2For(id, code)) === '1'; }); } catch (e) { return false; } }
  function setV2(code) { try { ids().forEach(function (id) { localStorage.setItem(key2For(id, code), '1'); }); } catch (e) { /* 無痕模式或被封鎖：略過 */ } }
  function hasSeen() { try { return ids().some(function (id) { return localStorage.getItem(keyFor(id)) === '1'; }) || seenV2('core'); } catch (e) { return false; } }
  function hasFeatureSeen(code) { return seenV2(code) || !!S.hinted[ids().join('|') + ':' + code]; }
  function markFeature(code) { S.hinted[ids().join('|') + ':' + code] = true; setV2(code); }
  function markCore(codes) {
    try { ids().forEach(function (id) { localStorage.setItem(keyFor(id), '1'); }); } catch (e) { /* 無痕模式或被封鎖：略過 */ }
    setV2('core'); (codes || []).forEach(markFeature);
  }
  function markSeen() { markCore(FEATURES.map(function (f) { return f.code; })); }   /* 整個玩法指南都記為看過（測試與舊程式沿用這個名稱） */
  function hasAnyRecord() {
    const p = (currentUser && currentUser.progress) || {};
    return Object.keys(p).some(function (isl) {
      const z = p[isl]; if (!z || typeof z !== 'object') return false;
      return Object.keys(z).some(function (k) { return Array.isArray(z[k]) && z[k].length > 0; });
    });
  }
  function totalStars() { try { return ProgressSystem.calcTotal((currentUser && currentUser.progress) || {}); } catch (e) { return 0; } }
  function shouldAuto() {
    if (!currentUser || !currentUser.progress || !currentUser.progress.avatar) return false;
    if (totalStars() !== 0 || Number(currentUser.total_stars) > 0 || hasAnyRecord()) return false;
    const m = $('screen-map'); if (!m || !m.classList.contains('active')) return false;
    return !hasSeen();
  }
  /* 自動播放的三種判斷結果：'go'＝現在就播；'wait'＝條件還沒準備好（稍後再看，有次數上限）；'no'＝這位學生不該自動播（有星星／有紀錄／看過） */
  function autoState(last) {
    if (!currentUser) return 'no';
    if (totalStars() !== 0 || Number(currentUser.total_stars) > 0 || hasAnyRecord() || hasSeen()) return 'no';
    if (!currentUser.progress || !currentUser.progress.avatar) return 'wait';               /* 角色還沒存好 */
    const m = $('screen-map'); if (!m || !m.classList.contains('active')) return 'wait';    /* 海圖還沒顯示 */
    if (!last && !visible($('node-add'))) return 'wait';                                    /* 海圖上的島還沒畫好；最後一次不再等，直接播（目標找不到時導覽會用置中卡片） */
    return 'go';
  }

  /* ---------- 取得真實畫面上的位置 ---------- */
  function resolveTarget(step) {
    if (!step || !step.target) return null;
    let t = null; try { t = step.target(); } catch (e) { t = null; }
    if (!t) return null;
    if (t.rect) return t;                         /* 已經是 {el, rect}（多個元素的聯集） */
    if (!visible(t)) return null;
    return { el: t, rect: toRect(t.getBoundingClientRect()) };
  }
  function reduced() {
    try { const de = document.documentElement; if (de && de.classList.contains('reduce-motion')) return true; } catch (e) { /* 測試環境 */ }
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  /* 手機瀏海／Home 指示條：讀 CSS 的 --safe-*（env(safe-area-inset-*)）實際算出的像素 */
  function safeInsets() {
    let p = $('tt-probe');
    if (!p) { p = document.createElement('div'); p.id = 'tt-probe'; p.setAttribute('aria-hidden', 'true'); p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:var(--safe-top,0px) var(--safe-right,0px) var(--safe-bottom,0px) var(--safe-left,0px)'; document.body.appendChild(p); }
    const c = getComputedStyle(p); const n = function (v) { return parseFloat(v) || 0; };
    return { t: n(c.paddingTop), r: n(c.paddingRight), b: n(c.paddingBottom), l: n(c.paddingLeft) };
  }
  function viewport() { const de = document.documentElement; return { w: de.clientWidth || window.innerWidth, h: window.innerHeight || de.clientHeight }; }
  void reduced;

  /* ---------- DOM（第一次需要時才建立，平常是隱藏的） ---------- */
  function build() {
    if (S.root) return S.root;
    const root = document.createElement('div'); root.id = 'tutorial-root'; root.className = 'tt-root'; root.hidden = true;
    root.innerHTML =
      '<div class="tt-dim" id="tt-dim"></div>' +
      '<div class="tt-spot" id="tt-spot" hidden></div>' +
      '<div class="tt-blk" data-pos="t"></div><div class="tt-blk" data-pos="b"></div><div class="tt-blk" data-pos="l"></div><div class="tt-blk" data-pos="r"></div><div class="tt-blk tt-cover" id="tt-cover" hidden></div>' +
      '<svg class="tt-arrow" id="tt-arrow" aria-hidden="true" focusable="false"><defs><marker id="tt-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#FFD166" stroke="#17324D" stroke-width="1.4" stroke-linejoin="round"/></marker></defs><path id="tt-arrow-path" d="" fill="none" stroke="#17324D" stroke-width="8" stroke-linecap="round" stroke-dasharray="1 14" opacity=".0"/><path id="tt-arrow-line" d="" fill="none" stroke="#FFD166" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 11" marker-end="url(#tt-head)"/></svg>' +
      '<section class="tt-card" id="tt-card" role="dialog" aria-modal="true" aria-labelledby="tt-title" aria-describedby="tt-body">' +
        '<div class="tt-card__top"><span class="tt-card__badge" id="tt-badge" aria-hidden="true">' + ic('compass', 22) + '新手航海導覽</span><span class="tt-stepno" id="tt-stepno"></span></div>' +
        '<div class="tt-dots" id="tt-dots" aria-hidden="true"></div>' +
        '<p class="tt-lead" id="tt-lead" hidden></p>' +
        '<h2 class="tt-title" id="tt-title" tabindex="-1"></h2>' +
        '<div class="tt-body" id="tt-body"></div>' +
        '<div class="tt-actions"><button type="button" class="ds-btn ds-btn--ghost ds-btn--sm" id="tt-prev">上一步</button><button type="button" class="ds-btn ds-btn--coral ds-btn--sm" id="tt-next">下一步</button><button type="button" class="ds-btn ds-btn--link ds-btn--sm tt-skip" id="tt-skip">跳過導覽</button></div>' +
      '</section>' +
      '<div class="ds-sr-only" id="tt-live" role="status" aria-live="polite"></div>';
    document.body.appendChild(root);
    const cf = document.createElement('div'); cf.id = 'tt-confirm'; cf.className = 'ds-overlay tt-confirm'; cf.hidden = true; cf.setAttribute('data-modal', 'strict');
    cf.innerHTML = '<div class="ds-dialog" role="alertdialog" aria-modal="true" aria-labelledby="tt-confirm-title"><h2 class="ds-dialog__title" id="tt-confirm-title">要先跳過嗎？</h2><p class="ds-dialog__body">之後可以按「玩法指南」再看一次。</p><div class="ds-dialog__actions"><button type="button" class="ds-btn ds-btn--ghost" id="tt-confirm-no" data-autofocus>繼續導覽</button><button type="button" class="ds-btn ds-btn--coral" id="tt-confirm-yes">確定跳過</button></div></div>';
    document.body.appendChild(cf);
    S.root = root;
    $('tt-prev').addEventListener('click', prev); $('tt-next').addEventListener('click', next); $('tt-skip').addEventListener('click', askSkip);
    $('tt-confirm-no').addEventListener('click', function () { try { UIKit.closeDialog($('tt-confirm')); } catch (e) { /* 測試環境 */ } });
    $('tt-confirm-yes').addEventListener('click', function () { try { UIKit.closeDialog($('tt-confirm')); } catch (e) { /* 測試環境 */ } finish(true); });
    return root;
  }

  /* ---------- 示範港口（真正的港口視窗，唯讀） ---------- */
  function portOpen() { const o = $('modal-report'); return !!(o && o.style.display === 'flex'); }
  function openDemoPort() {
    if (portOpen()) { S.demoPort = true; return; }
    S.prevSelected = (typeof selectedIslandForModal !== 'undefined') ? selectedIslandForModal : '';
    try { showIslandModal('加法島'); S.demoPort = true; } catch (e) { S.demoPort = false; }
  }
  function closeDemoPort() {
    if (!S.demoPort && !portOpen()) return;
    try { IslandUI.closePort(true); } catch (e) { /* 測試環境 */ }
    try { selectedIslandForModal = S.prevSelected || ''; } catch (e) { /* 測試環境 */ }
    S.demoPort = false;
  }

  /* ---------- 版面：亮框、遮罩、說明卡、箭頭 ---------- */
  function subOpen() { return !!(($('tt-confirm') && $('tt-confirm').__open) || (typeof TitleRoute !== 'undefined' && TitleRoute.isOpen())); }

  function scrollIntoAvail(el, top, bottom) {   /* 目標不在可視範圍時，把最近的可捲動外層捲到合適位置（不改任何資料） */
    try {
      let n = el.parentElement, guard = 0;
      while (n && n !== document.documentElement && guard++ < 12) {
        const cs = getComputedStyle(n); const oy = cs.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
          const r = el.getBoundingClientRect(); let d = 0;
          if (r.top < top) d = r.top - top; else if (r.bottom > bottom) d = Math.min(r.bottom - bottom, r.top - top);
          if (d) n.scrollTop += d;
        }
        n = n.parentElement;
      }
    } catch (e) { /* 失敗就維持原位置 */ }
  }

  function placeCard(card, tgt, vp, ins) {
    const m = 12; const cw0 = Math.min(430, vp.w - 2 * m - ins.l - ins.r);
    card.className = card.className.replace(/\s*tt-card--(sheet|side|float|center|top)/g, '');
    card.style.cssText = '';
    let mode = 'float';
    if (vp.w < 600) mode = 'sheet';
    if (!tgt) { mode = vp.w < 600 ? 'sheet' : 'center'; }
    if (mode === 'sheet') {
      const maxH = Math.round((vp.h < 520 ? .62 : .46) * vp.h);
      card.classList.add('tt-card--sheet'); card.style.maxHeight = maxH + 'px';
      if (tgt) {
        const b0 = Math.max(8, ins.b), t0 = ins.t + 8; let ch = Math.min(card.offsetHeight, maxH);
        scrollIntoAvail(tgt.el || document.body, t0, vp.h - ch - b0 - 8);
        tgt = resolveTarget(S.cur) || tgt;
        /* 卡片放在目標下方（預設）或上方；兩邊都放不下時，縮小卡片（內容自己捲動）放在空間較大的一邊，不蓋住目標 */
        const below = vp.h - b0 - (tgt.rect.bottom + 8) - 6, above = (tgt.rect.top - 8) - t0 - 6;
        let place = 'bottom';
        if (below >= ch) place = 'bottom'; else if (above >= ch) place = 'top';
        else { const room = Math.max(below, above); if (room >= 150) { place = below >= above ? 'bottom' : 'top'; ch = room; card.style.maxHeight = Math.floor(room) + 'px'; } }
        if (place === 'top') { card.style.top = t0 + 'px'; card.style.bottom = 'auto'; card.classList.add('tt-card--top'); }
      }
      return tgt;
    }
    if (mode === 'center') { card.classList.add('tt-card--center'); card.style.width = cw0 + 'px'; card.style.maxHeight = (vp.h - 2 * m - ins.t - ins.b) + 'px'; return tgt; }
    /* float（桌機／平板／橫放手機）：把卡片放在目標的下方、右側、左側或上方——整張放得下就用（依這個順序）；
       都放不下（目標很大，例如港口的區域按鈕）就縮小卡片（內容在卡片裡捲動、按鈕列固定在底部），放在空間最大的一邊，不蓋住目標 */
    card.classList.add('tt-card--float');
    const g = vp.h < 500 ? 12 : 24, wMax = vp.w - ins.l - ins.r - 2 * m, hMax = vp.h - ins.t - ins.b - 2 * m;
    const cwN = Math.min(vp.h < 500 ? 380 : 430, wMax);
    card.style.width = cwN + 'px'; card.style.maxHeight = Math.max(160, hMax) + 'px';
    const chN = Math.min(card.offsetHeight, hMax), r = tgt.rect;
    const minX = ins.l + m, minY = ins.t + m;
    const A = [
      { k: 'b', w: wMax, h: vp.h - ins.b - m - (r.bottom + g) },
      { k: 'r', w: vp.w - ins.r - m - (r.right + g), h: hMax },
      { k: 'l', w: r.left - g - minX, h: hMax },
      { k: 't', w: wMax, h: r.top - g - minY }
    ].map(function (o) { const ew = Math.min(o.w, cwN), eh = Math.min(o.h, chN); return Object.assign(o, { ew: ew, eh: eh, fit: o.w >= cwN && o.h >= chN, score: (ew > 0 && eh > 0) ? (ew * eh) / (cwN * chN) : 0 }); });
    const fit = A.filter(function (o) { return o.fit; })[0];
    const ok2 = A.filter(function (o) { return o.ew >= 240 && o.eh >= 150; }).sort(function (a, b2) { return b2.score - a.score; })[0];
    const pick = fit || (ok2 && ok2.score >= .35 ? ok2 : null);
    if (!pick) { card.classList.remove('tt-card--float'); card.classList.add('tt-card--sheet'); card.style.width = ''; card.style.maxHeight = Math.round(.46 * vp.h) + 'px'; return tgt; }
    const ew = pick.ew, eh = fit ? chN : Math.floor(pick.eh);
    card.style.width = ew + 'px'; card.style.maxHeight = Math.max(150, eh) + 'px';
    const h2 = Math.min(card.offsetHeight, eh);
    const clampX = function (x) { return Math.max(minX, Math.min(vp.w - ins.r - m - ew, x)); }, clampY = function (y) { return Math.max(minY, Math.min(vp.h - ins.b - m - h2, y)); };
    let x, y;
    if (pick.k === 'b') { x = clampX(r.left + r.width / 2 - ew / 2); y = r.bottom + g; }
    else if (pick.k === 't') { x = clampX(r.left + r.width / 2 - ew / 2); y = r.top - g - h2; }
    else if (pick.k === 'r') { x = r.right + g; y = clampY(r.top + r.height / 2 - h2 / 2); }
    else { x = r.left - g - ew; y = clampY(r.top + r.height / 2 - h2 / 2); }
    card.style.left = clampX(x) + 'px'; card.style.top = clampY(y) + 'px';
    return tgt;
  }

  function drawArrow(card, tgt, vp) {
    const line = $('tt-arrow-line'), shadow = $('tt-arrow-path'), svg = $('tt-arrow'); if (!line || !svg) return;
    svg.setAttribute('width', vp.w); svg.setAttribute('height', vp.h); svg.setAttribute('viewBox', '0 0 ' + vp.w + ' ' + vp.h);
    if (!tgt) { line.setAttribute('d', ''); shadow.setAttribute('d', ''); return; }
    const c = toRect(card.getBoundingClientRect()), r = tgt.rect;
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2, tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    const edge = function (b, px, py, toX, toY, pad) {   /* 從矩形中心朝 (toX,toY) 走，停在矩形外框外 pad 像素 */
      const dx = toX - px, dy = toY - py; if (!dx && !dy) return { x: px, y: py };
      const sx = dx ? ((b.width / 2 + pad) / Math.abs(dx)) : Infinity, sy = dy ? ((b.height / 2 + pad) / Math.abs(dy)) : Infinity; const s = Math.min(sx, sy);
      return { x: px + dx * s, y: py + dy * s };
    };
    const a = edge(c, cx, cy, tx, ty, 2), z = edge(r, tx, ty, cx, cy, 12);
    const len = Math.hypot(z.x - a.x, z.y - a.y);
    if (len < 16) { line.setAttribute('d', ''); shadow.setAttribute('d', ''); return; }
    const mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2, nx = -(z.y - a.y) / len, ny = (z.x - a.x) / len, bend = Math.min(40, len * .2);
    const d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'Q' + (mx + nx * bend).toFixed(1) + ' ' + (my + ny * bend).toFixed(1) + ' ' + z.x.toFixed(1) + ' ' + z.y.toFixed(1);
    line.setAttribute('d', d); shadow.setAttribute('d', d);
  }

  function layout() {
    if (!S.active) return;
    const root = S.root, card = $('tt-card'); if (!root || !card) return;
    const vp = viewport(), ins = safeInsets(); const step = S.steps[S.step]; if (!step) return; S.cur = step;
    let tgt = null;
    try { tgt = resolveTarget(step); } catch (e) { tgt = null; }
    try { tgt = placeCard(card, tgt, vp, ins); } catch (e) { console.error('[tutorial]', e); tgt = null; card.className = 'tt-card tt-card--center'; card.style.cssText = ''; }
    const spot = $('tt-spot'), dim = $('tt-dim'), cover = $('tt-cover'); const blks = root.querySelectorAll('.tt-blk:not(.tt-cover)');
    S.hasTarget = !!tgt;
    if (!tgt) {       /* 沒有目標（第 1 步，或找不到元素）：整片遮罩＋畫面中央的一般說明卡，仍可上一步、下一步、跳過 */
      spot.hidden = true; cover.hidden = true; dim.hidden = false;
      for (let i = 0; i < blks.length; i++) { const b = blks[i]; b.style.cssText = 'left:0;top:0;width:100%;height:100%'; if (blks[i].dataset.pos !== 't') b.style.display = 'none'; }
      drawArrow(card, null, vp); return;
    }
    dim.hidden = true; spot.hidden = false;
    const pad = 8, r = tgt.rect; const L = Math.max(0, r.left - pad), T = Math.max(0, r.top - pad), R = Math.min(vp.w, r.right + pad), B = Math.min(vp.h, r.bottom + pad);
    const rad = Math.max(10, Math.min(26, Math.min(R - L, B - T) / 3));
    spot.style.cssText = 'left:' + L + 'px;top:' + T + 'px;width:' + (R - L) + 'px;height:' + (B - T) + 'px;border-radius:' + rad + 'px';
    for (let i = 0; i < blks.length; i++) {
      const b = blks[i], k = b.dataset.pos; b.style.display = '';
      if (k === 't') b.style.cssText = 'left:0;top:0;width:100%;height:' + T + 'px';
      else if (k === 'b') b.style.cssText = 'left:0;top:' + B + 'px;width:100%;height:' + Math.max(0, vp.h - B) + 'px';
      else if (k === 'l') b.style.cssText = 'left:0;top:' + T + 'px;width:' + L + 'px;height:' + (B - T) + 'px';
      else b.style.cssText = 'left:' + R + 'px;top:' + T + 'px;width:' + Math.max(0, vp.w - R) + 'px;height:' + (B - T) + 'px';
    }
    if (step.interactive) { cover.hidden = true; }      /* 亮框裡面的真實按鈕可以直接點 */
    else { cover.hidden = false; cover.style.cssText = 'left:' + L + 'px;top:' + T + 'px;width:' + (R - L) + 'px;height:' + (B - T) + 'px'; }
    drawArrow(card, tgt, vp);
  }
  function schedule() { if (S.raf || !S.active) return; S.raf = true; const f = function () { S.raf = false; layout(); }; if (window.requestAnimationFrame) window.requestAnimationFrame(f); else setTimeout(f, 16); }

  /* ---------- 步驟內容 ---------- */
  function renderStep() {
    const step = S.steps[S.step]; const n = S.steps.length; const last = S.step === n - 1;
    $('tt-stepno').textContent = '第 ' + (S.step + 1) + '／' + n + ' 步';
    const bd = $('tt-badge'); if (bd) { const c = S.chapter ? chapterOf(S.chapter) : null; bd.innerHTML = ic('compass', 22) + esc(c ? '玩法指南：' + c.title : '新手航海導覽'); }
    $('tt-dots').innerHTML = S.steps.map(function (_, i) { return '<i class="' + (i === S.step ? 'is-on' : (i < S.step ? 'is-done' : '')) + '"></i>'; }).join('');
    const lead = $('tt-lead'); lead.hidden = !step.lead; lead.textContent = step.lead || '';
    $('tt-title').textContent = step.title;
    let h = '<p class="tt-main">' + esc(step.main) + '</p>';
    if (step.main2) h += '<p class="tt-main">' + esc(step.main2) + '</p>';
    if (step.extra) h += step.extra();
    if (step.button) h += '<p class="tt-btnrow"><button type="button" class="ds-btn ds-btn--deep ds-btn--sm" id="' + step.button.id + '">' + ic(step.button.icon, 24) + esc(step.button.label) + '</button></p>';
    if (step.more) {
      const vp = viewport(); const open = (step.more.open === 'wide' && vp.w >= 600 && vp.h >= 640) || (step.more.open === 'order' && vp.h >= 560);
      h += '<details class="tt-more"' + (open ? ' open' : '') + '><summary>' + esc(step.more.label) + '</summary>' + step.more.html() + '</details>';
    }
    if (step.closing) h += '<p class="tt-closing">' + ic('lighthouse', 26) + esc(step.closing) + '</p>';
    $('tt-body').innerHTML = h;
    Array.prototype.forEach.call($('tt-body').querySelectorAll('details'), function (d) { d.addEventListener('toggle', schedule); });   /* 展開／收合詳細說明後重新排版 */
    const nx = $('tt-next');
    if (last) { nx.innerHTML = S.chapter ? '完成' : ic('lighthouse', 24) + '開始冒險'; nx.classList.add('ds-btn--gold'); } else { nx.innerHTML = '下一步'; nx.classList.remove('ds-btn--gold'); }
    const pv = $('tt-prev'); pv.hidden = S.step === 0;
    const ob = $('tt-open-route'); if (ob) ob.addEventListener('click', function () { try { TitleRoute.open(ob); } catch (e) { /* 失敗就維持在這一步 */ } });
    $('tt-live').textContent = '';
    $('tt-live').textContent = '第 ' + (S.step + 1) + ' 步，共 ' + n + ' 步：' + step.title;
  }
  /* 目標在畫面外（例如橫放手機時島嶼下方的星數）：把最近的可捲動外層捲到目標進入畫面為止（只改捲動位置，不改任何資料） */
  function reveal(step) {
    try {
      const t = resolveTarget(step); if (!t || !t.el) return; const vp = viewport(), ins = safeInsets(), r = t.rect;
      if (r.top >= ins.t && r.bottom <= vp.h - ins.b && r.left >= 0 && r.right <= vp.w) return;
      if (t.el.closest && t.el.closest('#tutorial-root')) return;
      t.el.scrollIntoView({ block: r.height > vp.h * .7 ? 'start' : 'center', inline: 'nearest' });
    } catch (e) { /* 失敗就維持原位置 */ }
  }
  function prepMap(step) {
    if (!step.map) return;
    try { if (typeof SeaMap !== 'undefined') SeaMap.centerOn(0, true); } catch (e) { /* 失敗就用目前位置 */ }
  }
  /* 換到第 i 步。dir：前進 1／後退 -1——遇到「開始時有、現在找不到目標」的步驟就把它拿掉，往同一個方向找下一步（不顯示空白卡片、不卡住） */
  /* 每次換步驟都重新依「現在畫面上有的功能」組一次：班級、寶箱的按鈕是等後端回應才出現的，
     導覽開始後才出現的功能會補進後面的步驟；導覽中途消失的功能會被拿掉。回傳原本要去的那一步在新清單裡的位置 */
  function syncSteps(target, dir) {
    const old = S.steps; if (!old.length) return 0;
    const t = Math.max(0, Math.min(old.length - 1, target)); const wantId = old[t].id;
    const fresh = compose(S.chapter).filter(function (s) { return !S.dropped[s.id]; });
    if (!fresh.length) { S.steps = []; return 0; }
    S.steps = fresh;
    let idx = fresh.map(function (s) { return s.id; }).indexOf(wantId);
    if (idx < 0) {
      for (let k = t; k >= 0 && k < old.length; k += dir) { const j = fresh.map(function (s) { return s.id; }).indexOf(old[k].id); if (j >= 0) { idx = j; break; } }
      if (idx < 0) idx = dir > 0 ? fresh.length - 1 : 0;
    }
    return idx;
  }
  function go(i, focus, dir) {
    if (!S.active) return;
    dir = dir || 1;
    let idx = syncSteps(i, dir);
    if (!S.steps.length) { finish(true); return; }
    for (let guard = 0; guard < 50; guard++) {
      const step = S.steps[idx]; if (!step) break;
      if (step.port) openDemoPort(); else closeDemoPort();
      prepMap(step);
      reveal(step);
      if (step.skipIfMissing && !resolveTarget(step)) {
        S.dropped[step.id] = true; S.steps.splice(idx, 1);
        if (!S.steps.length) { finish(true); return; }
        if (dir < 0) idx = Math.max(0, idx - 1);
        else if (idx > S.steps.length - 1) { finish(true); return; }
        continue;
      }
      S.step = idx; S.cur = step; S.shown[step.id] = true;
      renderStep(); layout();
      if (focus !== false) { try { $('tt-title').focus({ preventScroll: true }); } catch (e) { /* 測試環境 */ } }
      layout();
      return;
    }
    finish(true);
  }
  function next() { if (!S.active) return; if (S.step >= S.steps.length - 1) { finish(true); return; } go(S.step + 1, undefined, 1); }
  function prev() { if (!S.active) return; if (S.step > 0) go(S.step - 1, undefined, -1); }
  function askSkip() { if (!S.active) return; try { UIKit.openDialog($('tt-confirm'), $('tt-skip')); } catch (e) { finish(true); } }

  /* ---------- 開始／結束 ----------
     start('auto'|'manual', 觸發的按鈕, { chapter: 章節代碼 })：沒有 chapter → 必要導覽（依畫面上實際有的功能組成） */
  function start(mode, trigger, opt) {
    if (S.active || !currentUser) return false;
    if (typeof document === 'undefined' || !document.body || !document.documentElement || typeof window.addEventListener !== 'function') return false;   /* 沒有真正的瀏覽器畫面（例如單元測試的假 DOM）：不啟動 */
    const m = $('screen-map'); if (!m || !m.classList.contains('active')) return false;
    const chapter = opt && opt.chapter ? opt.chapter : null;
    const list = compose(chapter); if (!list.length) return false;
    try {
      cancelHint(); closeOverlays();
      build(); S.active = true; S.mode = mode || 'manual'; S.trigger = trigger || null; S.chapter = chapter;
      S.steps = list.slice(); S.dropped = {}; S.shown = {};
      try { S.prevScroll = $('screen-map').scrollTop; } catch (e) { S.prevScroll = 0; }
      try { S.prevIsland = (typeof SeaMap !== 'undefined' && SeaMap.state) ? SeaMap.state.current : null; } catch (e) { S.prevIsland = null; }
      S.root.hidden = false; document.documentElement.classList.add('tt-on');
      bindGlobal(); go(0);
      return true;
    } catch (e) {          /* 任何意外都不能讓畫面卡在遮罩上：整個收掉，學生照常玩 */
      console.error('[tutorial]', e); try { teardown(); } catch (e2) { S.active = false; if (S.root) S.root.hidden = true; }
      return false;
    }
  }
  function teardown() {
    S.active = false; S.step = 0;
    try { const c = $('tt-confirm'); if (c && c.__open) UIKit.closeDialog(c); } catch (e) { /* 測試環境 */ }
    try { if (typeof TitleRoute !== 'undefined' && TitleRoute.isOpen()) TitleRoute.close(); } catch (e) { /* 測試環境 */ }
    closeDemoPort();
    if (S.root) S.root.hidden = true; document.documentElement.classList.remove('tt-on');
    try { const sm = $('screen-map'); if (sm && S.prevScroll != null) sm.scrollTop = S.prevScroll; } catch (e) { /* 失敗就維持原位置 */ }
    try { if (S.prevIsland !== null && typeof SeaMap !== 'undefined' && SeaMap.centerOn) SeaMap.centerOn(S.prevIsland, true); } catch (e) { /* 失敗就維持原位置 */ }
  }
  function finish(mark) {
    if (!S.active) return;
    const chapter = S.chapter; const featuresIn = [];   /* 這次導覽介紹過、或排在這次導覽裡（跳過也算已看過）的功能 */
    STEPS.forEach(function (s) { if (s.feature && featuresIn.indexOf(s.feature) < 0 && (S.shown[s.id] || S.steps.indexOf(s) >= 0)) featuresIn.push(s.feature); });
    teardown();
    if (mark) {
      /* 完成最後一步或確認跳過：必要導覽 → 本裝置記為已看過（含導覽介紹到的功能）；只重看某一章 → 只記那一章的功能，不動「必要導覽」紀錄 */
      if (chapter) featuresIn.forEach(markFeature); else markCore(featuresIn);
    }
    S.chapter = null;
    const g0 = $('btn-guide'), g = visible(g0) ? g0 : $('btn-more'); try { if (g && g.focus) g.focus({ preventScroll: true }); } catch (e) { /* 測試環境 */ }
  }
  function cancelPending() {   /* 取消還沒做完的自動檢查（等待畫面的 requestAnimationFrame、重試用的 100ms 計時器） */
    const p = S.pend; S.pend = null; if (!p) return;
    try { if (p.raf && window.cancelAnimationFrame) window.cancelAnimationFrame(p.raf); } catch (e) { /* 測試環境 */ }
    try { if (p.timer) clearTimeout(p.timer); } catch (e) { /* 測試環境 */ }
  }
  function abort() { cancelPending(); cancelHint(); closeOverlays(); if (S.active) teardown(); S.chapter = null; }   /* 登出、換畫面：取消等待中的檢查，關掉遮罩、示範港口與選單，不記為看過 */

  /* ---------- 玩法指南：章節選單 ---------- */
  function buildMenu() {
    if ($('guide-menu')) return $('guide-menu');
    const o = document.createElement('div'); o.id = 'guide-menu'; o.className = 'ds-overlay tt-confirm tt-menu'; o.hidden = true;
    o.innerHTML = '<div class="ds-dialog tt-menu__dlg" role="dialog" aria-modal="true" aria-labelledby="gm-title"><h2 class="ds-dialog__title" id="gm-title">玩法指南</h2>' +
      '<p class="ds-dialog__body">想看哪一章？可以只看一章，也可以看完整導覽。</p><div class="tt-menu__list" id="gm-list"></div>' +
      '<div class="ds-dialog__actions"><button type="button" class="ds-btn ds-btn--gold" id="gm-all">' + ic('compass', 24) + '播放完整導覽</button><button type="button" class="ds-btn ds-btn--ghost" id="gm-close" data-autofocus>關閉</button></div></div>';
    document.body.appendChild(o);
    $('gm-close').addEventListener('click', function () { try { UIKit.closeDialog(o); } catch (e) { o.hidden = true; } });
    $('gm-all').addEventListener('click', function () { const t = o.__trigger; try { UIKit.closeDialog(o); } catch (e) { o.hidden = true; } start('manual', t); });
    $('gm-list').addEventListener('click', function (e) {
      const b = e.target && e.target.closest ? e.target.closest('button[data-ch]') : null; if (!b) return;
      const id = b.getAttribute('data-ch'), t = o.__trigger; try { UIKit.closeDialog(o); } catch (x) { o.hidden = true; } start('manual', t, { chapter: id });
    });
    return o;
  }
  function openMenu(trigger) {
    if (S.active || !currentUser) return false;
    const o = buildMenu(); const list = $('gm-list'); const chs = availableChapters();
    list.innerHTML = chs.map(function (c) {
      return '<button type="button" class="tt-menu__item" data-ch="' + esc(c.id) + '"><span class="tt-menu__ico" aria-hidden="true">' + ic(c.icon, 28) + '</span><span class="tt-menu__txt"><b>' + esc(c.title) + '</b><small>' + esc(c.sub) + '</small></span><span class="tt-menu__n" aria-hidden="true">' + compose(c.id).length + ' 步</span></button>';
    }).join('');
    try { UIKit.openDialog(o, trigger || $('btn-guide')); } catch (e) { o.hidden = false; }
    return true;
  }
  function closeOverlays() {
    ['guide-menu', 'tt-hint'].forEach(function (id) { const o = $(id); if (o && o.__open) { try { UIKit.closeDialog(o); } catch (e) { o.hidden = true; } } });
  }

  /* ---------- 舊帳號的「新功能提示」：最多一則、合併、只出現一次 ---------- */
  const HINT_MS = 1800;
  function unseenFeatures() { return FEATURES.filter(function (f) { let a = false; try { a = !!f.available(); } catch (e) { a = false; } return a && !hasFeatureSeen(f.code); }); }
  function cancelHint() { if (S.hintTimer) { try { clearTimeout(S.hintTimer); } catch (e) { /* 測試環境 */ } S.hintTimer = 0; } }
  function scheduleHint() { if (S.hintTimer || !currentUser) return; S.hintTimer = setTimeout(maybeHint, HINT_MS); }
  function otherDialogOpen() {
    return !!(document.querySelector('.ds-overlay.is-open') || portOpen() || (typeof TitleRoute !== 'undefined' && TitleRoute.isOpen()) || document.querySelector('.cb-overlay'));
  }
  function maybeHint() {
    S.hintTimer = 0;
    if (!currentUser || S.active || otherDialogOpen()) return;
    const m = $('screen-map'); if (!m || !m.classList.contains('active')) return;
    const list = unseenFeatures(); if (!list.length) return;
    list.forEach(function (f) { markFeature(f.code); });           /* 先記下來：同一台裝置只提示這一次 */
    const names = []; list.forEach(function (f) { const c = chapterOf(f.chapter); if (c && names.indexOf(c.title) < 0) names.push(c.title); });
    let o = $('tt-hint');
    if (!o) {
      o = document.createElement('div'); o.id = 'tt-hint'; o.className = 'ds-overlay tt-confirm tt-hint'; o.hidden = true;
      o.innerHTML = '<div class="ds-dialog" role="dialog" aria-modal="true" aria-labelledby="th-title"><h2 class="ds-dialog__title" id="th-title">玩法指南更新了</h2><p class="ds-dialog__body" id="th-body"></p>' +
        '<div class="ds-dialog__actions"><button type="button" class="ds-btn ds-btn--gold" id="th-open">' + ic('compass', 24) + '看看玩法指南</button><button type="button" class="ds-btn ds-btn--ghost" id="th-ok" data-autofocus>知道了</button></div></div>';
      document.body.appendChild(o);
      $('th-ok').addEventListener('click', function () { try { UIKit.closeDialog(o); } catch (e) { o.hidden = true; } });
      $('th-open').addEventListener('click', function () { const t = $('btn-guide'); try { UIKit.closeDialog(o); } catch (e) { o.hidden = true; } openMenu(visible(t) ? t : $('btn-more')); });
    }
    $('th-body').textContent = '新增了「' + names.join('」「') + '」的說明。想看的話，隨時按「玩法指南」，挑一章重看就好。';
    try { UIKit.openDialog(o, $('btn-guide')); } catch (e) { o.hidden = false; }
  }

  /* ---------- 全域事件（只綁一次） ---------- */
  function onKey(e) {
    if (!S.active || subOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); askSkip(); return; }
    if (e.key !== 'Tab') return;
    e.stopImmediatePropagation();            /* 不讓港口視窗自己的 Tab 迴圈搶走焦點 */
    const card = $('tt-card'); const f = Array.prototype.filter.call(card.querySelectorAll('button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'), function (n) { return n.offsetParent !== null; });
    const title = $('tt-title'); const list = [title].concat(f); const a = list[0], z = list[list.length - 1], cur = document.activeElement;
    if (!card.contains(cur)) { e.preventDefault(); a.focus(); return; }
    if (e.shiftKey && cur === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && cur === z) { e.preventDefault(); a.focus(); }
  }
  function onClickCapture(e) {   /* 第 2 步：點亮框裡的真實加法島 → 直接打開該島港口，導覽接著介紹三個區域 */
    if (!S.active || !S.steps[S.step] || S.steps[S.step].id !== 'island') return;
    const t = e.target && e.target.closest ? e.target.closest('#node-add') : null; if (!t) return;
    e.preventDefault(); e.stopPropagation(); go(S.step + 1, undefined, 1);
  }
  function onFocusIn(e) {
    if (!S.active || subOpen()) return;
    if (S.root && !S.root.contains(e.target)) { try { $('tt-title').focus({ preventScroll: true }); } catch (x) { /* 測試環境 */ } }
  }
  function bindGlobal() {
    if (S.bound) return; S.bound = true;
    window.addEventListener('keydown', onKey, true);       /* 掛在 window 的捕獲階段：比港口視窗、對話框掛在 document 的鍵盤處理更早收到 Esc／Tab */
    window.addEventListener('resize', schedule); window.addEventListener('orientationchange', schedule);
    window.addEventListener('scroll', schedule, true);
    try { if (window.visualViewport) { window.visualViewport.addEventListener('resize', schedule); window.visualViewport.addEventListener('scroll', schedule); } } catch (e) { /* 舊瀏覽器 */ }
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('click', onClickCapture, true);
  }

  /* ---------- 與其他畫面的接點 ---------- */
  const RETRY_MAX = 10, RETRY_MS = 100;   /* 最多再試 10 次、每次隔 100ms（約 1 秒）；之後放棄，不留任何計時器 */
  function onScreen(id) {
    if (id !== 'screen-map') { abort(); return; }                       /* 離開海圖：取消等待中的檢查，並關掉導覽 */
    if (!currentUser || S.autoFor === currentUser) return;              /* 這次登入已經成功自動播放過了 */
    if (S.pend && S.pend.user === currentUser) return;                  /* 這位學生已經在等了 */
    cancelPending();
    const p = S.pend = { user: currentUser, tries: 0, raf: 0, timer: 0 };
    /* 只有「成功呼叫 start('auto')」才記為這次登入已經自動播放過；條件還沒好就留著機會，稍後再試 */
    const tick = function () {
      p.raf = 0; p.timer = 0;
      if (S.pend !== p) return;                                         /* 已被取消 */
      if (currentUser !== p.user || (($('screen-map') || {}).classList && !$('screen-map').classList.contains('active'))) { cancelPending(); S.why = 'left'; return; }   /* 登出、換學生或離開海圖 */
      let v = 'no';
      try { v = autoState(p.tries >= RETRY_MAX); } catch (e) { console.error('[tutorial]', e); v = 'no'; }
      if (v === 'go') {
        let ok = false; try { ok = start('auto', null); } catch (e) { console.error('[tutorial]', e); }
        if (ok) { S.autoFor = p.user; S.why = 'started'; cancelPending(); return; }
        v = 'wait'; S.why = 'start-failed';
      }
      if (v === 'no') { S.why = 'not-new'; cancelPending(); scheduleHint(); return; }   /* 不是新學生：看看有沒有導覽沒介紹過的功能，有的話約 2 秒後提示一次 */
      if (p.tries >= RETRY_MAX) { S.why = 'gave-up'; cancelPending(); return; }
      p.tries++; S.why = 'waiting';
      p.timer = setTimeout(tick, RETRY_MS);
    };
    if (window.requestAnimationFrame) p.raf = window.requestAnimationFrame(function () { p.raf = window.requestAnimationFrame(tick); }); else tick();
  }
  function init() {
    const g = $('btn-guide'); if (g) g.addEventListener('click', function () { openMenu(g); });
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }

  return {
    VERSION: VERSION, KEY_PREFIX: KEY_PREFIX, KEY2_PREFIX: KEY2_PREFIX, STEPS: STEPS, CHAPTERS: CHAPTERS, FEATURES: FEATURES, state: S,
    keyFor: keyFor, key2For: key2For, hasSeen: hasSeen, hasFeatureSeen: hasFeatureSeen, markSeen: markSeen, markFeature: markFeature, shouldAuto: shouldAuto,
    compose: compose, availableChapters: availableChapters, registerChapter: registerChapter, openMenu: openMenu, maybeHint: maybeHint,
    start: start, next: next, prev: prev, go: go, askSkip: askSkip, finish: finish, abort: abort, onScreen: onScreen, layout: layout, isActive: function () { return S.active; }
  };
})();
