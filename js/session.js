/* 登入狀態與學號狀態（階段 9B-1）
   * 登入憑證（token）只放在這個頁面的記憶體裡：重新整理、關閉分頁就會消失，必須重新登入。
     不寫入 localStorage／sessionStorage／Cookie，也不放在網址。
   * 學生的 token 是否被後端要求，由後端旗標決定（預設關閉，相容舊流程）；有拿到就自動附在 submit_answer 上。
   * 學號狀態：ok（後端給了學號）／temporary（示範或離線，臨時編號）／missing（後端沒給學號）。
     只有 ok 可以使用階段 9 的班級、任務、獎勵、裝備功能。 */
const AuthSession = {
    student: null,   // { token, expires_at, absolute_expires_at, scope }
    teacher: null,   // { token, expires_at, profile }
    admin: null,     // { token, expires_at }
    clearAll: function () {
        const sent = [];
        const bye = (action, s) => { if (s && s.token && typeof GAS_URL === 'string' && GAS_URL.indexOf('http') === 0) { sent.push(action); try { apiCall({ action: action, token: s.token }); } catch (e) { /* 登出失敗不影響本機清除 */ } } };
        bye('student_logout', this.student); bye('teacher_logout', this.teacher); bye('admin_logout', this.admin);
        this.student = null; this.teacher = null; this.admin = null;
        return sent;
    }
};

const StudentIdentity = {
    status: 'none',
    set: function (st) { this.status = st; this.render(); },
    /* 階段 9 的班級、任務、獎勵、裝備功能（之後的階段）一律先問這個函式 */
    stage9Allowed: function () { return this.status === 'ok'; },
    label: function () {
        if (this.status === 'temporary') return '示範模式：進度不會保存';
        if (this.status === 'missing') return '帳號資料需要老師確認';
        return '';
    },
    render: function () {
        const el = document.getElementById('id-badge'); if (!el) return;
        const t = this.label(); el.textContent = t; el.hidden = !t;
        if (document.body) { if (t) document.body.setAttribute('data-id-status', this.status); else document.body.removeAttribute('data-id-status'); }
    }
};

const SessionGuard = {
    shown: false,
    studentExpired: function () {
        if (this.shown) return; this.shown = true;
        AuthSession.student = null;
        alert('登入已經過期了，請重新登入，才能繼續保存進度。');
        this.shown = false;
        if (typeof logoutToRoleSelect === 'function') logoutToRoleSelect();
    }
};
