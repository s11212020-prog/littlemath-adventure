/* ==========================================================================
   階段 9E-2：船員小屋的網路層（CabinNet）
   * 只包裝既有的 apiCall 與 4 個獎勵 action（get_student_inventory／claim_reward／redeem_voucher／save_equipped_items），
     以及「存制服色」用的既有 submit_answer（只送 update_progress.avatar，不送作答、不送星星）。沒有新增任何後端 action。
   * token 由 apiCall 自動附上（已在 STUDENT_TOKEN_ACTIONS）；這裡不碰 token、不存任何東西到瀏覽器。
   * request_id 只放在記憶體：同一件事重試沿用同一個；新的操作產生新的。
   * 把回應分成幾種結果，畫面才不會把「功能沒開」和「暫時讀不到」混在一起：
       ok      成功
       off     FEATURE_OFF：獎勵功能沒有開放（只有這個會讓入口消失）
       session 登入過期／必須先改 PIN／權限不足（需要學生自己處理）
       schema  SCHEMA_NOT_READY：後端資料表還沒準備好（不是暫時的網路問題）
       unknown 沒有拿到明確答覆：斷線、逾時、BUSY、SERVER_ERROR、讀不懂的回應 → 寫入類操作「還不知道有沒有成功」，要先重新查詢
       denied  伺服器明確拒絕（有錯誤碼）：這次沒有寫入
   ========================================================================== */
const CabinNet = (function () {
  'use strict';

  let seq = 0;
  /** 產生符合後端規則的 request_id（8～64 個英數、底線、減號）。只用於記憶體，不存瀏覽器 */
  function newRequestId() {
    seq++;
    let r = '';
    try { const a = new Uint32Array(3); (self.crypto || window.crypto).getRandomValues(a); r = Array.prototype.map.call(a, function (n) { return n.toString(36); }).join(''); }
    catch (e) { r = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
    return ('cr' + seq + '_' + Date.now().toString(36) + '_' + r).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  }

  const SESSION_CODES = ['SESSION_INVALID', 'MUST_CHANGE_PIN', 'FORBIDDEN_LIMITED'];
  const UNKNOWN_CODES = ['BUSY', 'SERVER_ERROR', 'BAD_REQUEST', 'UNKNOWN_ACTION'];

  function classify(res) {
    if (res && res.status === 'success') return { kind: 'ok', data: res };
    if (!res || typeof res !== 'object') return { kind: 'unknown', message: '連線失敗，請檢查網路後再試一次' };
    if (res.status === 'offline') return { kind: 'unknown', message: '目前沒有連上網路服務' };
    const code = typeof res.code === 'string' ? res.code : '';
    const out = { code: code, message: typeof res.message === 'string' ? res.message : '', data: res };
    if (code === 'FEATURE_OFF') out.kind = 'off';
    else if (code === 'SCHEMA_NOT_READY') out.kind = 'schema';
    else if (SESSION_CODES.indexOf(code) >= 0) out.kind = 'session';
    else if (!code || UNKNOWN_CODES.indexOf(code) >= 0) out.kind = 'unknown';
    else out.kind = 'denied';
    return out;
  }
  async function call(payload) {
    let res;
    try { res = await apiCall(payload); } catch (e) { res = null; }
    return classify(res);
  }

  return {
    newRequestId: newRequestId, classify: classify,
    /** 讀取：物品、星星、補選券、目前裝備 */
    inventory: function () { return call({ action: 'get_student_inventory' }); },
    /** 星星寶箱二選一（首次領取） */
    claim: function (tierId, itemId, requestId) { return call({ action: 'claim_reward', tier_id: tierId, chosen_item_id: itemId, request_id: requestId }); },
    /** 用島嶼大師補選券補選 */
    redeem: function (island, itemId, requestId) { return call({ action: 'redeem_voucher', island: island, chosen_item_id: itemId, request_id: requestId }); },
    /** 存裝備與髮色（整包；version 是讀到時的 equipped_version，兩台裝置同時改時後端會回 VERSION_CONFLICT） */
    saveEquipped: function (equipped, version) { return call({ action: 'save_equipped_items', equipped: equipped, version: version }); },
    /** 存制服色：既有的「更新進度」路徑，只更新 avatar（後端 mergeProgress_ 只取 avatar，其餘不動）。重複存同一個值沒有副作用 */
    saveUniform: function (avatarCode) {
      if (typeof currentUser === 'undefined' || !currentUser) return Promise.resolve({ kind: 'denied', code: 'NO_USER', message: '沒有登入的學生' });
      return call({ action: 'submit_answer', username: currentUser.username, user_id: currentUser.user_id, update_progress: { avatar: avatarCode } });
    }
  };
})();
