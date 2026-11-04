/* 階段 9B-2：學生帳號保護（密碼）畫面
   * 全部畫面由這支程式建立；畫面上的文字一律用 textContent 寫入（不把後端的字串當成 HTML）。
   * 密碼、密碼重設碼只存在輸入框裡，送出後立刻清空；不寫入 localStorage／sessionStorage／Cookie／網址。
   * 登入頁的帳號、密碼欄與「忘記密碼？」永遠顯示（寫在 index.html，不看 get_auth_config）；後端沒有升級或狀態異常時，
     新帳號不能註冊，在註冊畫面按「建立帳號」送出時才說明原因。註冊成功後直接選角色／進海圖，不會詢問密碼重設碼。
   * 新帳號建立時就要設定密碼；畫面上沒有任何一次性驗證碼的入口。忘記密碼用密碼重設碼，或由老師／管理員重設。 */
const StudentPin = (function () {
    const $ = function (id) { return document.getElementById(id); };
    const online = function () { return typeof GAS_URL === 'string' && GAS_URL.indexOf('http') === 0; };
    /* 後端狀態（cfg.state）：
         legacy          後端是舊版，完全不認得 get_auth_config（回 UNKNOWN_ACTION）→ 當作「沒有密碼功能」，流程和 9B-1／8.1 一樣
         not_initialized 新後端，但環境還沒建立第 9 階段的表 → 同上，沒有密碼功能
         ready 密碼功能正常 → 顯示密碼欄位與註冊設密碼
         degraded / unavailable  新後端，但帳號保護的設定壞了（缺密鑰或表格）→ 顯示提醒，不可無密碼註冊
         error           連不上、或回了看不懂的內容 → 無法確認，不可無密碼註冊（可按「重新檢查」）
         paused          管理員暫停了學生登入 */
    const cfg = { loaded: false, state: 'unknown', pin_available: false, pin_required_for_new: false, paused: false, notice: '', classes_enabled: null };
    const st = { scope: null, pinStatus: 'none', compat: false, notice: null, collapsed: false, busy: false, backTo: 'screen-student-login', recoveryReturn: 'game', profile: null };
    let cfgPromise = null;

    /* 正式環境是全新的試算表，不會有「只有帳號、沒有密碼」的舊式學生帳號；這則提醒只給相容舊後端／舊資料用，沒有任何設定入口 */
    const COMPAT_TEXT = '這個帳號還沒有設定密碼。請告訴老師或管理員。';
    const CFG_MSG = {
        degraded: '帳號保護功能暫時無法使用，請先告訴老師或管理員。已經設定密碼的帳號暫時無法登入；現在也不能註冊新帳號。',
        unavailable: '帳號保護功能暫時無法使用，請先告訴老師或管理員。已經設定密碼的帳號暫時無法登入；現在也不能註冊新帳號。',
        error: '現在無法確認帳號保護功能是否正常，所以暫時不能註冊新帳號。請檢查網路後按「重新檢查」，或告訴老師。',
        paused: '系統暫時維護中，暫時不能登入。請稍後再試，或告訴老師。'
    };
    const NOPIN_MSG = '現在還不能建立帳號（密碼功能尚未準備好），請告訴老師或管理員。';
    const OFFLINE_MSG = '目前是示範模式（沒有連到後端），這個功能需要連線後才能使用。';

    /* ---------- 小工具 ---------- */
    function el(tag, props, kids) {
        const e = document.createElement(tag);
        if (props) Object.keys(props).forEach(function (k) {
            if (k === 'text') e.textContent = props[k];
            else if (k === 'class') e.className = props[k];
            else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), props[k]);
            else e.setAttribute(k, props[k]);
        });
        (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
        return e;
    }
    /* 學生看得到的文字一律用「顯示名稱」：後端訊息裡若還寫「暱稱」，只在顯示時換字（後端、API、欄位名稱 nickname 都不變） */
    function shown(t) { return String(t == null ? '' : t).split('暱稱').join('顯示名稱'); }
    /* 後端訊息裡若還寫「PIN」「保護碼」，只在顯示時換成「密碼」「密碼重設碼」（後端規則與訊息不變；apiCall 也已統一換過一次，這裡是雙保險） */
    function words(t) { return shown(t).split('PIN').join('密碼').split('保護碼').join('密碼重設碼'); }
    function say(id, t) { const e = $(id); if (e) e.textContent = shown(t); }
    function val(id) { const e = $(id); return e ? e.value : ''; }
    function wipe(ids) { ids.forEach(function (id) { const e = $(id); if (e) e.value = ''; }); }
    function btn(label, cls, fn, id) { const b = el('button', { type: 'button', class: 'ds-btn ' + cls + ' ds-btn--block', text: label }); if (id) b.id = id; b.addEventListener('click', fn); return b; }
    function field(id, label, opt) {
        opt = opt || {};
        const props = { type: opt.type || 'text', id: id, class: 'ds-input', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' };
        if (opt.pin) { props.type = 'password'; props.inputmode = 'numeric'; props.pattern = '[0-9]*'; props.maxlength = '6'; props.placeholder = '4～6 個數字'; }
        if (opt.maxlength) props.maxlength = String(opt.maxlength);
        if (opt.placeholder) props.placeholder = opt.placeholder;
        return el('div', { class: 'ds-field' }, [el('label', { class: 'ds-label', for: id, text: label }), el('input', props)]);
    }
    function para(text, cls) { return el('p', { class: cls || 'tp-hint', text: text }); }
    function errLine(id) { return el('p', { id: id, class: 'ds-error en-error', role: 'alert' }); }
    function mkScreen(id, title, body) {
        if ($(id)) return $(id);
        const sea = el('div', { class: 'en-sea', 'aria-hidden': 'true' }, [el('i', { class: 'en-sun' }), el('i', { class: 'en-cloud en-cloud--1' }), el('i', { class: 'en-cloud en-cloud--2' }), el('i', { class: 'en-isle en-isle--1' }), el('i', { class: 'en-waves' })]);
        const brand = el('div', { class: 'en-card__brand' }, [el('span', { class: 'app-name' }, [el('span', { class: 'bn-main', text: '小小算術家' }), el('span', { class: 'bn-colon', text: '：' }), el('span', { class: 'bn-sub', text: '六島大冒險' })])]);
        const card = el('div', { class: 'ds-card ds-card--canvas en-card sp-card' }, [brand, el('h1', { class: 'ds-plank en-card__title', text: title })].concat(body));
        const s = el('div', { id: id, class: 'screen en-screen sp-screen' }, [sea, el('div', { class: 'en-wrap en-wrap--card' }, [card])]);
        document.body.appendChild(s);
        return s;
    }
    function open(id) { if (typeof switchScreen === 'function') switchScreen(id); }
    async function call(payload, button) {
        if (!online()) return { status: 'offline', message: OFFLINE_MSG };
        if (st.busy || (typeof Loading !== 'undefined' && Loading.busy)) return null;
        st.busy = true; if (button) button.disabled = true;
        try {
            const r = await apiCall(payload);
            if (r && r.code === 'SESSION_INVALID' && AuthSession.student && typeof SessionGuard !== 'undefined') { SessionGuard.studentExpired(); return null; }
            return r || { status: 'error', message: '連線失敗，請檢查網路後再試一次' };
        } catch (e) { console.error(e); return { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; }
        finally { st.busy = false; if (button) button.disabled = false; }
    }
    const pinFormat = function (p) { return /^\d{4,6}$/.test(p); };
    function fmtTime(iso) { return String(iso || '').replace('T', ' ').slice(0, 16); }

    /* ---------- 設定與登入畫面 ---------- */
    function loadConfig() {
        if (!online()) return Promise.resolve();
        if (cfgPromise) return cfgPromise;
        cfgPromise = (async function () {
            let r = null;
            try { r = await apiCall({ action: 'get_auth_config' }); } catch (e) { r = null; }
            applyConfig(r);
        })();
        const done = function () { cfgPromise = null; };
        cfgPromise.then(done, done);
        return cfgPromise;
    }
    /* 把 get_auth_config 的回應整理成 cfg.state。只有「舊後端不認得這個動作」才算沒有密碼功能；其他看不懂的都算無法確認 */
    function applyConfig(r) {
        let state = 'error', notice = '';
        if (r && r.status === 'success') {
            const ps = r.pin_state;
            if (ps === 'ready' || ps === 'not_initialized' || ps === 'degraded' || ps === 'unavailable') state = ps;
            else if (ps === undefined && r.pin_available === true) state = 'ready';            // 較早的 9B-2 回應沒有 pin_state
            else if (ps === undefined && r.pin_available === false) state = 'not_initialized';
            if (r.paused === true || r.maintenance === true) state = 'paused';            // 9F-3a：maintenance＝後端 fail-closed 維護中，顯示同一則白話訊息
            notice = r.notice || '';
        } else if (r && r.code === 'UNKNOWN_ACTION') state = 'legacy';
        cfg.state = state; cfg.notice = notice; cfg.paused = state === 'paused';
        cfg.pin_available = state === 'ready';
        cfg.pin_required_for_new = state === 'ready' && r.pin_required_for_new === true;
        cfg.classes_enabled = r && r.status === 'success' && typeof r.classes_enabled === 'boolean' ? r.classes_enabled : null;
        cfg.loaded = true; syncLogin();
    }
    /* 註冊前先確認後端狀態；回傳 { ok, mode, message }。mode：'pin'＝走有密碼的註冊；'plain'＝沿用 9B-1／8.1 的註冊；blocked＝不可註冊 */
    function gateNow() {
        if (cfg.state === 'ready') return { ok: true, mode: 'pin' };
        if (cfg.state === 'legacy' || cfg.state === 'not_initialized') return { ok: true, mode: 'plain' };
        return { ok: false, mode: 'blocked', message: CFG_MSG[cfg.state] || CFG_MSG.error };
    }
    /* 已經確認過狀態時「立刻」回傳結果（不多等一拍，連點的防護才不會失效）；還沒確認或上次是 error 時回傳 Promise，先重新問一次後端 */
    function registerGate() {
        if (!online()) return { ok: true, mode: 'plain' };
        if (!cfg.loaded || cfg.state === 'error' || cfg.state === 'unknown') return loadConfig().then(gateNow);
        return gateNow();
    }
    function configNotice() {
        let n = $('student-pin-notice');
        if (!n) {
            const w = $('student-pin-wrap'); if (!w || !w.parentNode) return null;
            n = el('div', { id: 'student-pin-notice', class: 'sp-cfg-notice', role: 'status', 'aria-live': 'polite', hidden: '' }, [
                el('p', { id: 'student-pin-notice-text', class: 'tp-note' }),
                el('button', { type: 'button', id: 'student-pin-recheck', class: 'btn-view', text: '重新檢查', onclick: function () { loadConfig(); } })
            ]);
            w.parentNode.insertBefore(n, w);
        }
        return n;
    }
    function syncLogin() {
        /* 帳號、密碼、「忘記密碼？」從第一個畫面就固定顯示（寫在 index.html），不看 get_auth_config 的結果，也不會閃出舊畫面；
           這裡只負責「後端狀態有問題時」顯示一則說明 */
        const n = configNotice();
        if (n) {
            const msg = CFG_MSG[cfg.state] || '';
            n.hidden = !msg; $('student-pin-notice-text').textContent = msg;
            $('student-pin-recheck').hidden = cfg.state !== 'error';
        }
    }

    /* ---------- 建立所有畫面 ---------- */
    function build() {
        if ($('screen-sp-register')) return;
        mkScreen('screen-sp-register', '建立新帳號', [
            para('幫自己取一個帳號，再設定 4 到 6 個數字的密碼。不用老師、也不用班級，現在就能開始冒險！'),
            field('spr-username', '帳號', { maxlength: 30, placeholder: '例如: 3A01小明' }),
            field('spr-nick', '顯示名稱', { maxlength: 12, placeholder: '最多 12 個字' }),
            para('這是遊戲中顯示的名字，請不要填寫完整真實姓名。', 'tp-note'),
            field('spr-pin', '設定密碼', { pin: true }), field('spr-pin2', '再次輸入密碼', { pin: true }),
            errLine('spr-msg'),
            btn('建立帳號', 'ds-btn--coral', function () { doRegister(this); }, 'spr-submit'),
            btn('返回', 'ds-btn--ghost en-back', function () { wipe(['spr-pin', 'spr-pin2']); say('spr-msg', ''); open('screen-student-login'); })
        ]);
        mkScreen('screen-sp-code', '你的密碼重設碼', [
            para('這是你的密碼重設碼，請抄下來放好，或下載存起來。只會顯示這一次，之後沒有人能再看到。'),
            el('div', { class: 'atp-temp sp-code-box' }, [el('code', { id: 'spc-code', class: 'sp-code' })]),
            btn('下載密碼重設碼', 'ds-btn--sea', function () { downloadCode(); }, 'spc-download'),
            btn('我已抄好', 'ds-btn--gold', function () { closeCode(); }, 'spc-done')
        ]);
        mkScreen('screen-sp-forgot', '忘記密碼', [
            para('如果你之前建立過密碼重設碼，可以用它重新設定密碼。沒有密碼重設碼的話，請告訴老師或管理員，他們會當面確認後幫你重設。'),
            field('spf-username', '帳號', { maxlength: 30 }), field('spf-code', '密碼重設碼', { maxlength: 12, placeholder: '8 個字' }),
            field('spf-pin', '設定新的密碼', { pin: true }), field('spf-pin2', '再次輸入新的密碼', { pin: true }),
            errLine('spf-msg'), para('', 'tp-note sp-ok'),
            btn('重設密碼', 'ds-btn--gold', function () { doForgot(this); }, 'spf-submit'),
            btn('返回登入', 'ds-btn--ghost en-back', function () { wipe(['spf-code', 'spf-pin', 'spf-pin2']); say('spf-msg', ''); setOk('screen-sp-forgot', ''); open('screen-student-login'); })
        ]);
        mkScreen('screen-sp-force', '先設定你的新密碼', [
            para('你剛剛用的是老師或管理員幫你設定的臨時密碼。請先設定自己的新密碼，才能繼續玩。'),
            field('spx-old', '臨時密碼', { pin: true }), field('spx-new', '新的密碼', { pin: true }), field('spx-new2', '再輸入一次新的密碼', { pin: true }),
            errLine('spx-msg'), btn('設定新密碼', 'ds-btn--gold', function () { doChange(this, 'spx'); }, 'spx-submit'),
            btn('改天再說（登出）', 'ds-btn--ghost en-back', function () { logoutToRoleSelect(); })
        ]);
        mkScreen('screen-account', '我的帳號', []);
        banner();
    }

    function setOk(screenId, text) { const p = document.querySelector('#' + screenId + ' .sp-ok'); if (p) { p.textContent = text || ''; p.hidden = !text; } }

    /* ---------- 註冊 ---------- */
    function openRegister(username) {
        build(); wipe(['spr-pin', 'spr-pin2']); say('spr-msg', '');
        const u = $('spr-username'); if (u) u.value = username || '';
        const nk = $('spr-nick'); if (nk) nk.value = '';                       // 9F-3a：暱稱一開始是空白，不預設成代碼
        open('screen-sp-register');
    }
    async function doRegister(b) {
        const username = val('spr-username').trim(), nick = val('spr-nick').trim(), pin = val('spr-pin'), pin2 = val('spr-pin2');
        say('spr-msg', '');
        if (!username) { say('spr-msg', '請輸入帳號。'); return; }
        if (!nick) { say('spr-msg', '請幫自己取一個顯示名稱（不要填寫完整真實姓名）。'); return; }
        if (nick.length > 12 || /[<>]/.test(nick) || /^[=+\-@]/.test(nick)) { say('spr-msg', '顯示名稱要 1～12 個字，不能含 < > 或以 = + - @ 開頭。'); return; }
        if (!pinFormat(pin)) { say('spr-msg', '密碼要是 4 到 6 個數字。'); return; }
        if (pin !== pin2) { say('spr-msg', '兩次輸入的密碼不一樣。'); return; }
        /* 後端狀態與安全檢查放在送出當下：不影響註冊畫面的開啟。新帳號一定要設定密碼，所以舊後端／尚未啟用密碼功能時不能註冊 */
        if (st.busy || (typeof Loading !== 'undefined' && Loading.busy)) return;
        if (online()) {
            let gate = registerGate();
            if (gate && typeof gate.then === 'function') { st.busy = true; if (b) b.disabled = true; if (typeof Loading !== 'undefined') Loading.show(); try { gate = await gate; } finally { if (typeof Loading !== 'undefined') Loading.hide(); st.busy = false; if (b) b.disabled = false; } }
            if (!gate.ok) { say('spr-msg', gate.message); return; }
            if (gate.mode !== 'pin') { say('spr-msg', NOPIN_MSG); return; }
        }
        const r = await call({ action: 'register', username: username, nickname: nick, pin: pin, pin_confirm: pin2 }, b); if (!r) return;
        if (r.status === 'offline') {   /* 示範模式（沒有連到後端）：維持原本的示範登入，不經過密碼檢查 */
            wipe(['spr-pin', 'spr-pin2']);
            const du = $('student-username'); if (du) du.value = username;
            finishStudentLogin({ status: 'offline' }, username);
            return;
        }
        wipe(['spr-pin', 'spr-pin2']);
        if (r.status !== 'success') { say('spr-msg', r.message || '註冊失敗，請稍後再試。'); return; }
        const u = $('student-username'); if (u) u.value = username;
        finishStudentLogin(r, username);   // tourfix2.1：註冊成功後直接選角色／進海圖，不再詢問要不要建立密碼重設碼
    }

    /* ---------- 密碼重設碼 ---------- */
    async function doCreateRecovery(b, pinId, msgId, regenerate) {
        const pin = val(pinId); say(msgId, '');
        if (!pinFormat(pin)) { say(msgId, '請輸入你目前的密碼（4 到 6 個數字）。'); return; }
        const r = await call(regenerate ? { action: 'regenerate_recovery_code', pin: pin } : { action: 'create_recovery_code', pin: pin }, b); if (!r) return;
        wipe([pinId]);
        if (r.status !== 'success') { say(msgId, r.message || '無法建立密碼重設碼。'); return; }
        const c = $('spc-code'); if (c) c.textContent = r.recovery_code; st.profile = null;
        open('screen-sp-code');
    }
    function downloadCode() {
        const c = $('spc-code'); if (!c || !c.textContent) return;
        const who = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : '';
        const blob = new Blob(['小小算術家：六島大冒險\n帳號：' + who + '\n密碼重設碼：' + c.textContent + '\n請收好，不要給別人。忘記密碼時可以用它重新設定。\n'], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = el('a', { href: url, download: '密碼重設碼.txt' });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    function closeCode() {
        const c = $('spc-code'); if (c) c.textContent = '';
        if (st.recoveryReturn === 'account') { st.recoveryReturn = 'game'; openAccount(); } else enterGame();
    }

    /* ---------- 忘記密碼（密碼重設碼） ---------- */
    function openForgot() { build(); wipe(['spf-code', 'spf-pin', 'spf-pin2']); say('spf-msg', ''); setOk('screen-sp-forgot', ''); const u = $('spf-username'); if (u) u.value = val('student-username').trim(); open('screen-sp-forgot'); }
    async function doForgot(b) {
        const username = val('spf-username').trim(), code = val('spf-code').trim(), pin = val('spf-pin'), pin2 = val('spf-pin2');
        say('spf-msg', ''); setOk('screen-sp-forgot', '');
        if (!username || !code) { say('spf-msg', '請輸入帳號和密碼重設碼。'); return; }
        if (!pinFormat(pin)) { say('spf-msg', '密碼要是 4 到 6 個數字。'); return; }
        if (pin !== pin2) { say('spf-msg', '兩次輸入的密碼不一樣。'); return; }
        const r = await call({ action: 'reset_pin_with_recovery_code', username: username, recovery_code: code, new_pin: pin, new_pin_confirm: pin2 }, b); if (!r) return;
        wipe(['spf-code', 'spf-pin', 'spf-pin2']);
        if (r.status !== 'success') { say('spf-msg', words(r.message) || '重設失敗，請稍後再試。'); return; }
        setOk('screen-sp-forgot', '密碼已重設。其他裝置上的登入都已登出。這組密碼重設碼已作廢，建議登入後重新建立一組。');
    }

    /* ---------- 改密碼（含臨時密碼強制更改） ---------- */
    function forceChange() { build(); wipe(['spx-old', 'spx-new', 'spx-new2']); say('spx-msg', ''); open('screen-sp-force'); }
    async function doChange(b, prefix) {
        const o = val(prefix + '-old'), n = val(prefix + '-new'), n2 = val(prefix + '-new2'), msg = prefix + '-msg';
        say(msg, '');
        if (!pinFormat(o)) { say(msg, '請輸入目前的密碼（4 到 6 個數字）。'); return; }
        if (!pinFormat(n)) { say(msg, '新的密碼要是 4 到 6 個數字。'); return; }
        if (n !== n2) { say(msg, '兩次輸入的新密碼不一樣。'); return; }
        const r = await call({ action: 'change_pin', old_pin: o, new_pin: n, new_pin_confirm: n2 }, b); if (!r) return;
        wipe([prefix + '-old', prefix + '-new', prefix + '-new2']);
        if (r.status !== 'success') { say(msg, r.message || '無法更改密碼。'); return; }
        if (r.session && r.session.token) AuthSession.student = r.session;     // 其他裝置全部登出；這裡換成新的登入憑證
        st.scope = 'full'; st.pinStatus = 'active'; refreshChrome();
        if (prefix === 'spx') { enterGame(); return; }
        say(msg, ''); setAccountNote('密碼已更改。其他裝置上的登入都已登出。');
    }

    /* ---------- 登入完成後 ---------- */
    function afterAuth(res) {
        const s = res && res.session && res.session.scope ? res.session.scope : null;
        st.scope = s; st.pinStatus = (res && res.pin_status) || (s === 'full' || s === 'must_change' ? 'active' : 'none');
        st.notice = (res && res.notice) || null; st.collapsed = false; st.profile = null;
        /* 新後端能可靠辨識「沒有密碼的帳號」時會回 account_protection:'unprotected'（即使後端沒有開學生登入憑證）；
           此時顯示可收合的提醒，進度、星星、作答行為都不變。舊後端或環境未升級不會有這個欄位，就不顯示。 */
        st.compat = !!(res && res.account_protection === 'unprotected' && online());
        if (s || st.compat) build();     // 示範／離線／舊後端（沒有 session、也沒有 account_protection）不建立任何額外畫面
        refreshChrome();
        if (typeof StudentClass !== 'undefined' && s) StudentClass.afterLogin(res);     // 9C：班級入口（選填）；失敗只是不顯示
        return !!(res && res.must_change_pin);
    }
    function refreshChrome() {
        const logged = online() && AuthSession.student && AuthSession.student.token && cfg.pin_available !== undefined && st.scope !== null;
        const b = $('btn-account'); if (b) b.hidden = !logged;
        renderBanner();
    }

    /* ---------- 提醒橫幅（只在海圖畫面顯示） ---------- */
    function banner() {
        if ($('sp-banner')) return;
        const b = el('div', { id: 'sp-banner', class: 'sp-banner', role: 'region', 'aria-label': '帳號提醒', hidden: '' }, [
            el('p', { id: 'sp-banner-text', class: 'sp-banner__text' }),
            el('div', { class: 'sp-banner__btns' }, [
                el('button', { type: 'button', id: 'sp-banner-toggle', class: 'btn-view', text: '收合', 'aria-expanded': 'true', onclick: function () { st.collapsed = !st.collapsed; renderBanner(); } })
            ])
        ]);
        const map = $('screen-map'); if (map && map.parentNode) map.parentNode.insertBefore(b, map.nextSibling); else document.body.appendChild(b);
    }
    function noticeText() {
        const n = st.notice; if (!n) return '';
        const when = fmtTime(n.at), who = n.by || '老師或管理員';
        if (n.type === 'activated') return '你的帳號在 ' + when + ' 由 ' + who + ' 確認後設定了密碼。如果不是你本人，請馬上告訴老師或管理員。';
        if (n.type === 'reset') return '你的密碼在 ' + when + ' 被 ' + who + ' 重設過。如果你不知道這件事，請告訴老師或管理員。';
        if (n.type === 'recovery') return '你的密碼在 ' + when + ' 用密碼重設碼重設過。如果不是你，請馬上告訴老師或管理員。';
        return '';
    }
    function renderBanner() {
        const b = $('sp-banner'); if (!b) return;
        let text = '';
        const compat = online() && (st.compat || (AuthSession.student && AuthSession.student.token && st.scope === 'limited'));
        if (compat) text = COMPAT_TEXT;
        else if (online() && AuthSession.student && AuthSession.student.token) text = noticeText();
        if (!text) { b.hidden = true; b.removeAttribute('data-collapsed'); return; }
        b.hidden = false; $('sp-banner-text').textContent = text;
        b.setAttribute('data-collapsed', st.collapsed ? 'yes' : 'no');
        const t = $('sp-banner-toggle'); t.textContent = st.collapsed ? '展開提醒' : '收合'; t.setAttribute('aria-expanded', st.collapsed ? 'false' : 'true');
    }


    /* ---------- 我的帳號 ---------- */
    function setAccountNote(t) { const n = $('sa-note'); if (n) n.textContent = shown(t); }
    async function openAccount() {
        if (!online() || !AuthSession.student) return;
        build(); st.backTo = 'screen-account'; renderAccount(null); open('screen-account');
        const r = await call({ action: 'get_profile' }); if (!r) return;
        if (r.status === 'success') { st.profile = r; st.scope = r.scope; st.pinStatus = r.pin_status; if (r.notice) st.notice = r.notice; refreshChrome(); renderAccount(r); }
        else setAccountNote(r.message || '無法載入帳號資料。');
    }
    function renderAccount(p) {
        const s = $('screen-account'); const card = s.querySelector('.sp-card'); if (!card) return;
        Array.prototype.slice.call(card.children).forEach(function (c, i) { if (i >= 2) card.removeChild(c); });
        const full = (p ? p.scope : st.scope) === 'full';
        const who = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.username : '';
        card.appendChild(para('帳號：' + who, 'tp-hello'));
        card.appendChild(el('p', { id: 'sa-note', class: 'tp-note', role: 'status', 'aria-live': 'polite' }));
        setAccountNote(p ? '' : '載入中…');
        if (full) {
            card.appendChild(para('你的帳號已設定密碼。'));
            card.appendChild(field('sa-nick', '顯示名稱（最多 12 個字）', { maxlength: 12 }));
            card.appendChild(btn('儲存顯示名稱', 'ds-btn--sea', function () { doProfile(this); }, 'sa-save-nick'));
            /* 不收集真實姓名：這裡沒有填姓名的欄位。若管理員已經登記過，才唯讀顯示；更正由老師或管理員處理 */
            if (p && p.real_name) card.appendChild(para('姓名：' + p.real_name + '（如需更正，請找老師或管理員）'));
            else card.appendChild(para('玩遊戲不需要提供真實姓名。', 'tp-note'));
            card.appendChild(el('h2', { class: 'tp-hello', text: '更改密碼' }));
            card.appendChild(field('sa-old', '目前的密碼', { pin: true })); card.appendChild(field('sa-new', '新的密碼', { pin: true })); card.appendChild(field('sa-new2', '再輸入一次新的密碼', { pin: true }));
            card.appendChild(errLine('sa-msg'));
            card.appendChild(btn('更改密碼', 'ds-btn--gold', function () { doChange(this, 'sa'); }, 'sa-change'));
            card.appendChild(el('h2', { class: 'tp-hello', text: '密碼重設碼' }));
            const has = !!(p && p.has_recovery_code);
            card.appendChild(para(has ? '你已經建立過密碼重設碼。重新產生後，舊的密碼重設碼就不能用了。' : '你還沒有密碼重設碼。建立後，忘記密碼時可以用它重新設定。'));
            card.appendChild(field('sa-rc-pin', '輸入目前的密碼來確認', { pin: true })); card.appendChild(errLine('sa-rc-msg'));
            card.appendChild(btn(has ? '重新產生密碼重設碼' : '建立密碼重設碼', 'ds-btn--sea', function () { st.recoveryReturn = 'account'; doCreateRecovery(this, 'sa-rc-pin', 'sa-rc-msg', has); }, 'sa-rc'));
            if (p) { const n = $('sa-nick'); if (n) n.value = p.nickname || ''; }
        } else {
            card.appendChild(para(COMPAT_TEXT, 'tp-note'));
        }
        card.appendChild(btn('回到海圖', 'ds-btn--ghost en-back', function () { open('screen-map'); }, 'sa-back'));
        card.appendChild(btn('登出', 'ds-btn--ghost', function () { logoutToRoleSelect(); }, 'sa-logout'));
    }
    async function doProfile(b) {
        setAccountNote('');
        const payload = { action: 'update_student_profile' };
        const v = val('sa-nick').trim(); if (!v) { setAccountNote('請輸入顯示名稱。'); return; } payload.nickname = v;
        const r = await call(payload, b); if (!r) return;
        if (r.status !== 'success') { setAccountNote(r.message || '無法儲存。'); return; }
        if (typeof currentUser !== 'undefined' && currentUser) { currentUser.nickname = payload.nickname; try { if (typeof EffectEngine !== 'undefined') EffectEngine.updateMap(); } catch (e) { /* 畫面更新失敗不影響儲存 */ } }
        setAccountNote('顯示名稱已儲存。');
    }

    function reset() {
        st.scope = null; st.pinStatus = 'none'; st.compat = false; st.notice = null; st.collapsed = false; st.profile = null; st.backTo = 'screen-student-login'; st.recoveryReturn = 'game';
        ['spr-pin', 'spr-pin2', 'spf-code', 'spf-pin', 'spf-pin2', 'spx-old', 'spx-new', 'spx-new2', 'student-pin', 'sa-old', 'sa-new', 'sa-new2', 'sa-rc-pin'].forEach(function (id) { const e = $(id); if (e) e.value = ''; });
        const c = $('spc-code'); if (c) c.textContent = '';
        const b = $('btn-account'); if (b) b.hidden = true;
        const bn = $('sp-banner'); if (bn) bn.hidden = true;
        if (typeof StudentClass !== 'undefined') StudentClass.reset();
        if (typeof StudentTasks !== 'undefined') StudentTasks.reset();
        if (typeof TaskRun !== 'undefined') TaskRun.reset();
    }

    function init() {
        const sb = $('btn-role-student'); if (sb) sb.addEventListener('click', function () { loadConfig(); });
        syncLogin();
    }
    if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);

    return {
        pinAvailable: function () { return cfg.pin_available; }, classesEnabled: function () { return cfg.classes_enabled !== false; }, registerGate: registerGate, configState: function () { return cfg.state; }, requiredForNew: function () { return cfg.pin_required_for_new; },
        loadConfig: loadConfig, openRegister: openRegister, openForgot: openForgot, openAccount: openAccount,
        afterAuth: afterAuth, forceChange: forceChange, reset: reset, refresh: refreshChrome, _state: st, _cfg: cfg
    };
})();
