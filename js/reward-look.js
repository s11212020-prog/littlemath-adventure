/* ==========================================================================
   階段 9E-2：本人的裝備外觀（RewardLook）—— 只在「明確的本人顯示位置」套用裝備
   為什麼要這個檔：
   * 裝備屬於「某一位學生」，不屬於「某個角色代碼」。同一個角色（例如都是 C1-0-0）的兩位學生，頭像不可以互相套用裝備。
   * 所以這裡的判定不看角色代碼，只看「身分」：記憶體裡的裝備狀態記著它屬於哪位學生（owner＝登入時的 user_id）；
     每次要畫之前，都拿它和「目前登入的學生」比對，不一致就一律回到原本的畫法。
   * 套用的位置也是明確列出來的（呼叫端只有這 5 處，見 docs/階段9E-2_行為說明與已知限制.md）：
       海圖左上角的本人頭像（js/map.js）、小船（js/sea-map.js）、冒險日誌頭像（js/island.js）、
       稱號航線頭像（js/title-route.js）、闖關畫面的小船員（js/island-ui.js）。
     其他任何地方（選角色畫面、老師看到的學生名單……）完全不呼叫這裡，不會套用裝備。
   * 不使用任何瀏覽器儲存；只放在這個頁面的記憶體裡，重新整理就沒有，登入後重新從雲端讀。
   * 功能關閉、尚未讀到、讀取失敗、換了學生、登出 → 一律回到 9E-1 的原本畫法（輸出逐字相同）。
   載入順序：index.html 最後面依序 rewards.js → reward-art.js → reward-look.js → cabin-net.js → cabin.js（reward-art 需要 crew.js、sea-art.js 已先載入）。
   map.js、sea-map.js 等呼叫端比它們先載入，但只在「畫面要重畫的當下」才呼叫，而且每個呼叫位置都先檢查 typeof RewardLook !== 'undefined'，所以載入順序不影響正確性。
   ========================================================================== */
const RewardLook = (function () {
  'use strict';
  let S = null;                       // { owner, equip: {欄位: 物品或 null}, hair: 髮色 id 或 null, version, rev }
  let rev = 0;

  /** 目前登入的學生身分（只有學號狀態 ok 才算；示範、離線、缺學號都是空字串） */
  function who() {
    try {
      if (typeof currentUser === 'undefined' || !currentUser) return '';
      if (typeof StudentIdentity === 'undefined' || !StudentIdentity.stage9Allowed()) return '';
      return String(currentUser.user_id || '');
    } catch (e) { return ''; }
  }
  /** 目前這份裝備狀態是不是「這位登入學生」的；不是就當作沒有 */
  function mine() { return (S && S.owner && S.owner === who()) ? S : null; }

  /** owner 必須由呼叫端在「發出請求當下」記下來；回應回來時若登入的人已經換了，就丟掉這份資料（回傳 false） */
  function set(owner, effective, hairId, version) {
    if (!owner || owner !== who()) return false;
    const e = {}; Object.keys(effective || {}).forEach(function (k) { e[k] = effective[k] || null; });
    S = { owner: owner, equip: e, hair: (hairId && RewardArt.HAIR_BY_ID[hairId]) ? hairId : null, version: Number(version) || 0, rev: ++rev };
    return true;
  }
  function clear() { S = null; }

  function worn(a) { return !!(a.equip.head || a.equip.hand || a.equip.badge1 || a.equip.badge2); }
  function hairHex(a) { return a.hair ? RewardArt.hairHex(a.hair) : null; }

  /** 本人頭像（半身）。沒有本人的裝備狀態、或裝備全是預設而且沒換髮色 → 回傳原本的 AvatarKit.bustHTML，逐字相同 */
  function ownBust(av, px) {
    const a = mine();
    if (!a || !AvatarKit.parse(av) || !(worn(a) || a.hair)) return AvatarKit.bustHTML(av, px);
    return RewardArt.bustHTML(av, a.equip, px, { hair: hairHex(a) });
  }
  /** 本人的小船內容（帆、船員、船身，含船旗／救生圈／船首像）。不是本人、或沒有可畫的頭像 → null，呼叫端用原本的畫法 */
  function ownBoatInner(av) {
    const a = mine();
    if (!a || !AvatarKit.parse(av)) return null;
    return RewardArt.boatInner(av, a.equip, 56, { crew: { hair: hairHex(a) } });
  }
  /** 小船快取用的鍵：沒有本人的裝備時是空字串（和 9E-1 的鍵相同），有的話隨每次更新改變 */
  function lookKey() { const a = mine(); return a ? '|rw' + a.rev : ''; }

  /** 讀取目前套用中的裝備（給小屋和測試用）；不是本人就回 null。回傳的是複本 */
  function current() { const a = mine(); return a ? { owner: a.owner, equip: Object.assign({}, a.equip), hair: a.hair, version: a.version, rev: a.rev } : null; }
  /** 重畫所有看得到的本人顯示位置（目前只有海圖上的頭像與小船；其他位置在下次開啟畫面時就會取到新狀態） */
  function repaint() {
    try {
      if (typeof EffectEngine !== 'undefined' && typeof currentUser !== 'undefined' && currentUser && currentUser.progress && document.getElementById('ui-my-avatar')) EffectEngine.updateMap();
    } catch (e) { /* 重畫失敗不影響其他功能 */ }
  }

  return { who: who, set: set, clear: clear, current: current, ownBust: ownBust, ownBoatInner: ownBoatInner, lookKey: lookKey, repaint: repaint };
})();
