/* 階段 9B-2：管理員「學生帳號保護」面板
   * 查詢學生保護狀態、確認身分後重設學生密碼、處理待處理清單、更正本名、查看稽核。
   * 臨時密碼只顯示一次，關閉面板或離開後台就清除；畫面文字一律用 textContent。
   * 顯示名稱、頭像、稱號不是確認身分的依據（固定提示文字）。 */
const AdminStudents = (function () {
    const $ = function (id) { return document.getElementById(id); };
    const say = function (id, t) { const e = $(id); if (e) e.textContent = t || ''; };
    const token = function () { return (AuthSession.admin && AuthSession.admin.token) || ''; };
    let busy = false;

    async function call(payload) {
        if (busy) { say('ast-msg', '上一個動作還在處理中，請稍候再按一次。'); return null; }
        busy = true;
        try {
            const r = await apiCall(Object.assign({ token: token() }, payload));
            if (r && r.code === 'SESSION_INVALID') { if (typeof adminSessionExpired === 'function') adminSessionExpired(); return null; }
            return r;
        } catch (e) { console.error(e); return { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; }
        finally { busy = false; }
    }
    function uname() { const v = $('ast-username'); return v ? v.value.trim() : ''; }
    function methodPayload() {
        const m = document.querySelector('input[name="ast-method"]:checked');
        const o = { confirmed: !!($('ast-confirm') && $('ast-confirm').checked), method: m ? m.value : '', reason: $('ast-reason') ? $('ast-reason').value.trim() : '' };
        if (o.method === 'other') o.method_other = $('ast-other') ? $('ast-other').value.trim() : '';
        return o;
    }
    function clearSecret() { const b = $('ast-secret'); if (b) b.hidden = true; say('ast-secret-label', ''); say('ast-secret-code', ''); say('ast-secret-note', ''); }
    function showSecret(label, code, note) { say('ast-secret-label', label); say('ast-secret-code', code); say('ast-secret-note', note); const b = $('ast-secret'); if (b) b.hidden = false; }
    function resetForm() { const c = $('ast-confirm'); if (c) c.checked = false; document.querySelectorAll('input[name="ast-method"]').forEach(function (r) { r.checked = false; }); ['ast-other', 'ast-reason'].forEach(function (id) { const e = $(id); if (e) e.value = ''; }); const w = $('ast-other-wrap'); if (w) w.hidden = true; }
    function line(parent, text) { const li = document.createElement('li'); li.textContent = text; parent.appendChild(li); }
    function when(t) { return String(t || '').replace('T', ' ').slice(0, 16); }

    return {
        enter: function () { const p = $('admin-students-panel'); if (p) p.hidden = false; },
        leave: function () { const p = $('admin-students-panel'); if (p) p.hidden = true; clearSecret(); resetForm(); say('ast-msg', ''); say('ast-info', ''); const l = $('ast-list'); if (l) l.textContent = ''; const u = $('ast-username'); if (u) u.value = ''; },
        methodChanged: function () { const m = document.querySelector('input[name="ast-method"]:checked'); const w = $('ast-other-wrap'); if (w) w.hidden = !(m && m.value === 'other'); },
        closeSecret: function () { clearSecret(); },
        find: async function (keepMsg) {
            if (keepMsg !== true) say('ast-msg', ''); const u = uname(); if (!u) { say('ast-msg', '請輸入學生的登入代碼。'); return; }
            const r = await call({ action: 'admin_student_security', username: u }); if (!r) return;
            if (r.status !== 'success') { say('ast-info', ''); say('ast-msg', r.message || '查詢失敗'); return; }
            const s = r.student, st = s.pin_status === 'none' ? '尚未設定 PIN（相容模式，只靠代碼登入）' : (s.pin_status === 'must_change' ? '使用臨時 PIN，學生登入後必須更改' : (s.pin_status === 'unknown' ? '狀態異常：帳號保護狀態無法確認，這個帳號暫時無法登入。請檢查憑證表該列（pin_status 欄位）後再處理' : '已啟用 PIN'));
            let t = '顯示名稱：' + (s.nickname || '') + '　狀態：' + st + '。';
            if (s.has_recovery_code) t += '學生已建立保護碼。';
            if (s.locked) t += '目前因輸錯太多次暫時鎖定。';
            if (s.needs_review) t += '已標記為「待處理」。';
            say('ast-info', t);
        },
        resetPin: async function () {
            say('ast-msg', ''); clearSecret(); const u = uname(); if (!u) { say('ast-msg', '請輸入學生的登入代碼。'); return; }
            if (!window.confirm('重設後，這位學生目前的密碼、所有登入和保護碼會立即失效。要繼續嗎？')) return;
            const r = await call(Object.assign({ action: 'admin_reset_student_pin', username: u }, methodPayload())); if (!r) return;
            if (r.status !== 'success') { say('ast-msg', r.message || '無法重設'); return; }
            showSecret('臨時密碼（只顯示這一次，24 小時內有效）', r.temp_pin, '學生登入後必須先更改。請當面交給學生。');
            resetForm(); await this.find(true);
        },
        clearReview: async function () {
            say('ast-msg', ''); const u = uname(); if (!u) { say('ast-msg', '請輸入學生的登入代碼。'); return; }
            const r = await call({ action: 'admin_set_needs_review', username: u, value: false }); if (!r) return;
            say('ast-msg', r.status === 'success' ? '已清除「待處理」標記。' : (r.message || '無法清除')); await this.find(true);
        },
        realName: async function () {
            say('ast-msg', ''); const u = uname(); if (!u) { say('ast-msg', '請輸入學生的登入代碼。'); return; }
            const name = $('ast-real') ? $('ast-real').value.trim() : '', reason = $('ast-reason') ? $('ast-reason').value.trim() : '';
            const r = await call({ action: 'admin_update_real_name', username: u, real_name: name, reason: reason }); if (!r) return;
            say('ast-msg', r.status === 'success' ? '已更正姓名，並寫入稽核紀錄。' : (r.message || '無法更正'));
        },
        listReview: async function () {
            say('ast-msg', ''); const l = $('ast-list'); if (l) l.textContent = '';
            const r = await call({ action: 'admin_list_review' }); if (!r) return;
            if (r.status !== 'success') { say('ast-msg', r.message || '無法載入'); return; }
            if (!r.students.length) { say('ast-msg', '目前沒有待處理的學生。'); return; }
            say('ast-msg', '待處理學生：');
            r.students.forEach(function (s) { line(l, s.username + '（顯示名稱：' + (s.nickname || '') + '）　標記時間：' + when(s.needs_review_at)); });
        },
        listAudit: async function () {
            say('ast-msg', ''); const l = $('ast-list'); if (l) l.textContent = '';
            const r = await call({ action: 'admin_list_audit', limit: 50 }); if (!r) return;
            if (r.status !== 'success') { say('ast-msg', r.message || '無法載入'); return; }
            say('ast-msg', '最近 ' + r.audit.length + ' 筆（共 ' + r.total + ' 筆）：');
            const F = { pin_code_issued: '核發啟用碼', pin_code_revoked: '啟用碼作廢', pin_activated: '啟用 PIN', pin_reset: '重設 PIN', pin_recovery: '保護碼重設 PIN', real_name: '姓名', display_name: '顯示名稱', teacher_verified: '教師確認', class_member: '班級關係' };
            r.audit.forEach(function (a) { line(l, when(a.changed_at) + '　' + (F[a.field] || a.field) + '　' + a.changed_by_role + '　' + (a.old_value || '') + ' → ' + (a.new_value || '')); });
        },
        listTeacherAudit: async function (teacherId, loginId) {
            say('ast-msg', ''); const l = $('ast-list'); if (l) l.textContent = '';
            const r = await call({ action: 'admin_list_audit', limit: 50, teacher_id: teacherId }); if (!r) return;
            if (r.status !== 'success') { say('atp-msg', r.message || '無法載入'); return; }
            const p = $('admin-students-panel'); if (p) { p.hidden = false; if (p.scrollIntoView) p.scrollIntoView({ block: 'nearest' }); }
            say('ast-msg', '教師「' + loginId + '」最近 ' + r.audit.length + ' 筆核發／確認紀錄（共 ' + r.total + ' 筆）：');
            const F = { pin_code_issued: '核發啟用碼', pin_code_revoked: '啟用碼作廢', pin_activated: '啟用 PIN', pin_reset: '重設 PIN', real_name: '姓名', class_member: '班級關係', teacher_verified: '教師確認' };
            r.audit.forEach(function (a) { line(l, when(a.changed_at) + '　' + (F[a.field] || a.field) + '　' + a.changed_by_role + '　' + (a.old_value || '') + ' → ' + (a.new_value || '')); });
        },
        setTeacherVerified: async function (teacherId, verified) {
            const r = await call({ action: 'admin_set_teacher_verified', teacher_id: teacherId, verified: verified }); if (!r) return r;
            return r;
        }
    };
})();
