/* 階段 9B-1：教師帳號（註冊／登入／強制改密碼／首頁）與管理員的教師帳號管理。
   * 所有來自後端的文字一律用 textContent 寫入畫面，不用 innerHTML。
   * 密碼只在送出那一次使用；成功或失敗後都會清空輸入框。token 只放記憶體（AuthSession）。
   * 示範模式（沒有後端網址）：說明需要連線，不假裝登入成功。 */
const TeacherPortal = (function () {
    const $ = (id) => document.getElementById(id);
    const val = (id) => { const e = $(id); return e ? e.value : ''; };
    const clear = (ids) => ids.forEach((id) => { const e = $(id); if (e) e.value = ''; });
    const say = (id, t) => { const e = $(id); if (e) e.textContent = t || ''; };
    const offlineMsg = '目前是示範模式（沒有連到後端），教師帳號功能需要連線後才能使用。';
    const TERMS_VERSION = '2026-10-T2';   // 必須和後端 TEACHER_TERMS_VERSION 相同
    let pwForced = false;       // 是否為第一次登入的強制改密碼
    let currentTeacher = null;

    function resetRegisterChoices() {
        document.querySelectorAll('input[name="tr-purpose"]').forEach((r) => { r.checked = false; });
        const a = $('tr-agree'); if (a) a.checked = false;
        const w = $('tr-other-wrap'); if (w) w.hidden = true;
        const t = $('tr-terms'); if (t) t.hidden = true;
        const b = $('tr-terms-toggle'); if (b) { b.setAttribute('aria-expanded', 'false'); b.textContent = '查看學生資料使用規範'; }
        const v = $('tr-terms-ver'); if (v) v.textContent = TERMS_VERSION;
    }

    function isOffline(res) { return res && res.status === 'offline'; }
    function errText(res, fallback) {
        if (!res) return fallback || '無法連線，請稍後再試。';
        if (res.status === 'offline') return offlineMsg;
        return res.message || fallback || '發生問題，請稍後再試。';
    }
    function sessionLost() {
        AuthSession.teacher = null; currentTeacher = null; Loading.hide();
        say('tl-msg', '登入已逾時（教師登入 8 小時後自動結束），請重新登入。');
        switchScreen('screen-teacher-login');
    }
    async function run(btnId, fn) {
        if (Loading.busy) return;
        const b = $(btnId); if (b) b.disabled = true;
        Loading.show();
        try { return await fn(); }
        catch (e) { console.error(e); return { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; }
        finally { Loading.hide(); if (b) b.disabled = false; }
    }

    function showHome() {
        const t = currentTeacher || {};
        say('th-hello', '歡迎，' + (t.display_name || '') + '！');
        say('th-school', t.school_name ? ('學校：' + t.school_name) : '');
        switchScreen('screen-teacher-home');
    }

    function afterAuth(res) {
        AuthSession.teacher = { token: res.token, expires_at: res.expires_at };
        currentTeacher = res.teacher || {};
        if (currentTeacher.must_change_password) startForcedPassword(); else showHome();
    }

    function startForcedPassword() {
        pwForced = true; clear(['tpw-old', 'tpw-new', 'tpw-new2']); say('tpw-msg', '');
        say('tpw-intro', '這是你第一次登入（或密碼剛被重設）。請先把臨時密碼換成只有你知道的新密碼，換好才能使用其他功能。');
        const c = $('tpw-cancel'); if (c) c.textContent = '取消並登出';
        switchScreen('screen-teacher-password');
    }

    return {
        sessionLost: sessionLost, showHome: showHome, getTeacher: function () { return currentTeacher; },
        open: function (screenId) { say('tl-msg', ''); say('tr-msg', ''); resetRegisterChoices(); switchScreen(screenId); },
        reset: function () {
            AuthSession.teacher = null; currentTeacher = null; pwForced = false;
            clear(['tl-login-id', 'tl-password', 'tr-login-id', 'tr-display', 'tr-school', 'tr-password', 'tr-password2', 'tr-purpose-text', 'tpw-old', 'tpw-new', 'tpw-new2']);
            resetRegisterChoices();
            ['tl-msg', 'tr-msg', 'tpw-msg', 'th-hello', 'th-school'].forEach((i) => say(i, ''));
            if (typeof AdminTeachers !== 'undefined') AdminTeachers.leave();
        },
        login: async function () {
            const loginId = val('tl-login-id').trim(), pw = val('tl-password');
            say('tl-msg', '');
            if (!loginId || !pw) { say('tl-msg', '請輸入教師帳號與密碼。'); return; }
            const res = await run('tl-submit', () => apiCall({ action: 'teacher_login', login_id: loginId, password: pw }));
            clear(['tl-password']);
            if (!res) return;
            if (res.status === 'success' && res.token) { clear(['tl-login-id']); afterAuth(res); return; }
            say('tl-msg', errText(res, '無法登入'));
        },
        toggleTerms: function () {
            const box = $('tr-terms'), btn = $('tr-terms-toggle'); if (!box || !btn) return;
            const open = box.hidden; box.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.textContent = open ? '收合學生資料使用規範' : '查看學生資料使用規範';
        },
        purposeChanged: function () {
            const w = $('tr-other-wrap'), o = $('tr-purpose-other'); if (w && o) w.hidden = !o.checked;
        },
        register: async function () {
            const loginId = val('tr-login-id').trim(), display = val('tr-display').trim(), school = val('tr-school').trim();
            const pw = val('tr-password'), pw2 = val('tr-password2');
            const sel = document.querySelector('input[name="tr-purpose"]:checked'), purpose = sel ? sel.value : '';
            const other = val('tr-purpose-text').trim();
            const agree = !!($('tr-agree') && $('tr-agree').checked);
            say('tr-msg', '');
            if (!loginId || !display) { say('tr-msg', '請填寫教師帳號與顯示名稱。'); return; }
            if (pw.length < 8) { say('tr-msg', '密碼至少要 8 個字。'); return; }
            if (pw !== pw2) { say('tr-msg', '兩次輸入的密碼不一樣。'); return; }
            if (!purpose) { say('tr-msg', '請選擇使用用途。'); return; }
            if (purpose === 'other' && (other.length < 2 || other.length > 30)) { say('tr-msg', '選「其他教學用途」時，請用 2～30 個字簡單說明。'); return; }
            if (!agree) { say('tr-msg', '請先勾選「我將本系統用於教學，並遵守學生資料使用規範」。'); return; }
            const body = { action: 'teacher_register', login_id: loginId, display_name: display, school_name: school, password: pw, password_confirm: pw2, usage_purpose: purpose, agree_terms: true, terms_version: TERMS_VERSION };
            if (purpose === 'other') body.usage_purpose_other = other;
            const res = await run('tr-submit', () => apiCall(body));
            clear(['tr-password', 'tr-password2']);
            if (!res) return;
            if (res.status === 'success' && res.token) { clear(['tr-login-id', 'tr-display', 'tr-school', 'tr-purpose-text']); resetRegisterChoices(); afterAuth(res); return; }
            if (res.code === 'REG_CLOSED') { say('tr-msg', '目前尚未開放教師帳號註冊。已有教師帳號的老師，請按「返回登入」登入。'); return; }   /* 旗標 FLAG_TEACHER_REGISTRATION=off 時後端回 REG_CLOSED；前端只改說明文字，不改旗標 */
            say('tr-msg', errText(res, '無法建立帳號'));
        },
        startVoluntaryPassword: function () {
            pwForced = false; clear(['tpw-old', 'tpw-new', 'tpw-new2']); say('tpw-msg', '');
            say('tpw-intro', '請輸入目前的密碼與新密碼。更改後，其他裝置上的登入會失效。');
            const c = $('tpw-cancel'); if (c) c.textContent = '取消';
            switchScreen('screen-teacher-password');
        },
        cancelPassword: function () { if (pwForced) logoutToRoleSelect(); else showHome(); },
        changePassword: async function () {
            const oldPw = val('tpw-old'), n1 = val('tpw-new'), n2 = val('tpw-new2');
            say('tpw-msg', '');
            if (!oldPw) { say('tpw-msg', '請輸入目前的密碼。'); return; }
            if (n1.length < 8) { say('tpw-msg', '新密碼至少要 8 個字。'); return; }
            if (n1 !== n2) { say('tpw-msg', '兩次輸入的新密碼不一樣。'); return; }
            if (!AuthSession.teacher) { sessionLost(); return; }
            const res = await run('tpw-submit', () => apiCall({ action: 'teacher_change_password', token: AuthSession.teacher.token, old_password: oldPw, new_password: n1 }));
            clear(['tpw-old', 'tpw-new', 'tpw-new2']);
            if (!res) return;
            if (res.status === 'success' && res.token) {
                AuthSession.teacher = { token: res.token, expires_at: res.expires_at };
                if (currentTeacher) currentTeacher.must_change_password = false;
                pwForced = false; showHome(); return;
            }
            if (res.code === 'SESSION_INVALID') { sessionLost(); return; }
            say('tpw-msg', errText(res, '無法更改密碼'));
        },
        getTeacher: function () { return currentTeacher; }
    };
})();

/* ---------- 管理員：教師帳號管理 ---------- */
const AdminTeachers = (function () {
    const $ = (id) => document.getElementById(id);
    const say = (id, t) => { const e = $(id); if (e) e.textContent = t || ''; };
    const token = () => (AuthSession.admin && AuthSession.admin.token) || '';
    let busy = false;

    function expired() { if (typeof adminSessionExpired === 'function') adminSessionExpired(); }
    async function call(payload) {
        if (busy) { say('atp-msg', '上一個動作還在處理中，請稍候再按一次。'); return null; }
        busy = true;
        try { const r = await apiCall(Object.assign({ token: token() }, payload)); if (r && r.code === 'SESSION_INVALID') { expired(); return null; } return r; }
        catch (e) { console.error(e); return { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; }
        finally { busy = false; }
    }
    function cell(tr, text, cls) { const td = document.createElement('td'); td.textContent = text === undefined || text === null ? '' : String(text); if (cls) td.className = cls; tr.appendChild(td); return td; }
    function btn(text, fn, id) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-view'; b.textContent = text; if (id) b.id = id; b.addEventListener('click', fn); return b; }

    function render(list) {
        const tb = $('atp-list'); if (!tb) return; tb.textContent = '';
        if (!list.length) { const tr = document.createElement('tr'); const td = cell(tr, '還沒有教師帳號。'); td.colSpan = 10; tb.appendChild(tr); return; }
        list.forEach((t) => {
            const tr = document.createElement('tr');
            cell(tr, t.login_id); cell(tr, t.display_name + (String(t.verified) === 'yes' ? '（管理員確認）' : '')); cell(tr, t.school_name);
            const PUR = { classroom: '課堂教學', tutoring: '課後輔導', other: '其他教學用途' };
            cell(tr, t.usage_purpose ? (PUR[t.usage_purpose] || '') + (t.usage_purpose === 'other' && t.usage_purpose_other ? '：' + t.usage_purpose_other : '') : '（管理員建立）');
            cell(tr, t.created_at ? String(t.created_at).replace('T', ' ').slice(0, 16) : '');
            cell(tr, t.registration_source === 'self_declared' ? ('自行聲明 ' + (t.terms_version || '')) : '管理員建立');
            const active = String(t.status) === 'active';
            cell(tr, active ? '使用中' : '已停用', active ? 'atp-st--active' : 'atp-st--disabled');
            cell(tr, t.last_login_at ? String(t.last_login_at).replace('T', ' ').slice(0, 16) : '尚未登入');
            cell(tr, (t.classes_active === undefined ? '—' : t.classes_active + ' ／ ' + t.classes_archived));
            const td = document.createElement('td'); const box = document.createElement('div'); box.className = 'atp-act';
            box.appendChild(btn('重設密碼', () => AdminTeachers.resetPw(t.teacher_id, t.login_id), 'atp-reset-' + t.teacher_id));
            box.appendChild(btn(active ? '停用' : '啟用', () => AdminTeachers.setStatus(t.teacher_id, active ? 'disabled' : 'active'), 'atp-toggle-' + t.teacher_id));
            const isV = String(t.verified) === 'yes';
            box.appendChild(btn(isV ? '取消管理員確認' : '設為管理員確認', () => AdminTeachers.setVerified(t.teacher_id, isV ? 'no' : 'yes'), 'atp-verify-' + t.teacher_id));
            if (isV) box.appendChild(btn('核發紀錄', () => { if (typeof AdminStudents !== 'undefined') AdminStudents.listTeacherAudit(t.teacher_id, t.login_id); }, 'atp-audit-' + t.teacher_id));
            td.appendChild(box); tr.appendChild(td); tb.appendChild(tr);
        });
    }

    return {
        enter: function () { const p = $('admin-teachers-panel'); if (p) p.hidden = false; if (typeof AdminStudents !== 'undefined') AdminStudents.enter(); return this.load(); },
        leave: function () { const p = $('admin-teachers-panel'); if (p) p.hidden = true; if (typeof AdminStudents !== 'undefined') AdminStudents.leave(); this.hideTemp(); const tb = $('atp-list'); if (tb) tb.textContent = ''; say('atp-msg', ''); say('atp-precheck-out', ''); },
        load: async function () {
            const r = await call({ action: 'admin_list_teachers' }); if (!r) return;
            if (r.status === 'success') render(r.teachers || []); else say('atp-msg', r.message || '無法載入教師名單');
        },
        create: async function () {
            const login = $('atp-login').value.trim(), display = $('atp-display').value.trim(), school = $('atp-school').value.trim();
            say('atp-msg', ''); if (!login || !display) { say('atp-msg', '請填寫教師帳號與顯示名稱。'); return; }
            const r = await call({ action: 'admin_create_teacher', login_id: login, display_name: display, school_name: school }); if (!r) return;
            if (r.status === 'success') {
                $('atp-login').value = ''; $('atp-display').value = ''; $('atp-school').value = '';
                this.showTemp(r.teacher.login_id, r.temp_password, r.temp_expires_at); say('atp-msg', '已建立教師帳號。'); await this.load();
            } else say('atp-msg', r.message || '無法建立');
        },
        resetPw: async function (teacherId, loginId) {
            if (!window.confirm('重設後，這位教師目前的密碼與所有登入會立即失效。要繼續嗎？')) return;
            const r = await call({ action: 'admin_reset_teacher_password', teacher_id: teacherId }); if (!r) return;
            if (r.status === 'success') { this.showTemp(loginId, r.temp_password, r.temp_expires_at); say('atp-msg', '已重設，舊密碼與登入已失效。'); await this.load(); }
            else say('atp-msg', r.message || '無法重設');
        },
        setStatus: async function (teacherId, status) {
            const r = await call({ action: 'admin_set_teacher_status', teacher_id: teacherId, status: status }); if (!r) return;
            if (r.status === 'success') { say('atp-msg', status === 'disabled' ? '已停用，這位教師的登入立即失效。' : '已重新啟用。'); await this.load(); }
            else say('atp-msg', r.message || '無法變更');
        },
        setVerified: async function (teacherId, verified) {
            if (verified === 'no' && !window.confirm('取消後，這位教師就不能再重設學生密碼。要繼續嗎？')) return;
            const r = await call({ action: 'admin_set_teacher_verified', teacher_id: teacherId, verified: verified }); if (!r) return;
            if (r.status === 'success') { say('atp-msg', verified === 'yes' ? '已設為管理員確認（這是選用的標示）。' : '已取消管理員確認。'); await this.load(); }
            else say('atp-msg', r.message || '無法變更');
        },
        showTemp: function (who, pw, exp) {
            $('atp-temp-who').textContent = who; $('atp-temp-pw').textContent = pw;
            $('atp-temp-exp').textContent = '有效期限：' + String(exp || '').replace('T', ' ').slice(0, 16) + '（24 小時）。關閉後無法再次查看。';
            $('atp-temp').hidden = false;
        },
        hideTemp: function () { const t = $('atp-temp'); if (t) t.hidden = true; const p = $('atp-temp-pw'); if (p) p.textContent = ''; },
        precheck: async function () {
            say('atp-precheck-out', '檢查中…');
            const r = await call({ action: 'admin_precheck_ids' }); if (!r) return;
            if (r.status !== 'success') { say('atp-precheck-out', r.message || '無法檢查'); return; }
            const c = r.precheck || {};
            let t = '檢查完成：學生 ' + (c.users || 0) + ' 筆、作答紀錄 ' + (c.logs || 0) + ' 筆。必須先處理 ' + (c.blocking || 0) + ' 項，可自動補齊 ' + (c.fixable || 0) + ' 項，需人工確認 ' + (c.manual || 0) + ' 項。';
            const hit = (c.checks || []).filter((x) => x.count > 0).map((x) => x.message + '：' + x.count);
            if (hit.length) t += ' 明細：' + hit.join('；') + '。';
            t += ' 這個檢查只讀取，不會修改任何資料。';
            say('atp-precheck-out', t);
        }
    };
})();
