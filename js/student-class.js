/* 階段 9C：學生「加入班級（選填）」、我的班級、離班、轉班畫面
   * 加入班級永遠是選填：登入與海圖從不被班級擋住；沒有任何畫面強迫輸入班級代碼；每個畫面都有「稍後再說，自己冒險」。
   * 全部畫面由這支程式建立；後端傳來的文字一律用 textContent 寫入，不當成 HTML。
   * 這裡不保存任何資料（沒有 localStorage／sessionStorage／Cookie）；班級代碼只在輸入框裡，送出後清空。
   * 「確認帳號身分」和「同意分享資料」是兩件事：老師當面確認身分、設定 PIN 只會保護帳號；老師要等學生在這裡看完完整說明、自己按「同意分享」之後，才看得到學習資料。
   * 後端沒有開班級功能（FLAG_CLASSES off）、舊後端、示範模式：入口按鈕不出現，其他功能完全不受影響。 */
const StudentClass = (function () {
    const $ = function (id) { return document.getElementById(id); };
    const online = function () { return typeof GAS_URL === 'string' && GAS_URL.indexOf('http') === 0; };
    /* 備援同意文字（C2 版，2026-10-C2）：平常畫面使用後端回傳的 consent_text，只有後端沒有回傳時才用這一份；內容要和後端 CONSENT_TEXT 逐字相同（有靜態測試比對） */
    const CONSENT_TEXT = '加入班級後，該班教師可以查看你在本學習工具中的既有與後續學習進度、作答情形及任務完成狀態。你離開班級之後，教師仍會保留你在班期間的任務結果（只有暱稱和當時的任務完成狀態，不含本名），但看不到你離開之後的任何新資料。';
    const EXIT_NOTE = '之後你隨時可以在「我的班級」按「離開班級」，老師就看不到你之後的學習資料，只保留你在班期間的任務結果（暱稱和當時的完成狀態，不含本名）；你的進度、星星、物品和裝扮都會留給你自己。';
    const SELF_PLAY = '不加入班級也沒關係，你可以照常自己冒險，星星、獎勵和裝扮都不受影響。';
    const st = { info: null, preview: null, mode: '', busy: false, enabled: false, code: '', prompted: false, watch: null };

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
    function say(id, t) { const e = $(id); if (e) e.textContent = t || ''; }
    function val(id) { const e = $(id); return e ? e.value : ''; }
    function btn(label, cls, fn, id) { const b = el('button', { type: 'button', class: 'ds-btn ' + cls + ' ds-btn--block', text: label }); if (id) b.id = id; b.addEventListener('click', fn); return b; }
    function para(text, cls) { return el('p', { class: cls || 'tp-hint', text: text }); }
    function errLine(id) { return el('p', { id: id, class: 'ds-error en-error', role: 'alert' }); }
    function field(id, label, opt) {
        opt = opt || {};
        const props = { type: 'text', id: id, class: 'ds-input', autocomplete: 'off', autocapitalize: opt.upper ? 'characters' : 'off', spellcheck: 'false' };
        if (opt.maxlength) props.maxlength = String(opt.maxlength);
        if (opt.placeholder) props.placeholder = opt.placeholder;
        return el('div', { class: 'ds-field' }, [el('label', { class: 'ds-label', for: id, text: label }), el('input', props)]);
    }
    function checkRow(id, text) { return el('label', { class: 'tp-check', for: id }, [el('input', { type: 'checkbox', id: id }), el('span', { text: text })]); }
    function mkScreen(id, title, body) {
        if ($(id)) return $(id);
        const sea = el('div', { class: 'en-sea', 'aria-hidden': 'true' }, [el('i', { class: 'en-sun' }), el('i', { class: 'en-cloud en-cloud--1' }), el('i', { class: 'en-cloud en-cloud--2' }), el('i', { class: 'en-isle en-isle--1' }), el('i', { class: 'en-waves' })]);
        const brand = el('div', { class: 'en-card__brand' }, [el('span', { class: 'app-name' }, [el('span', { class: 'bn-main', text: '小小算術家' }), el('span', { class: 'bn-colon', text: '：' }), el('span', { class: 'bn-sub', text: '六島大冒險' })])]);
        const card = el('div', { class: 'ds-card ds-card--canvas en-card sp-card sc-card' }, [brand, el('h1', { class: 'ds-plank en-card__title', text: title })].concat(body));
        const s = el('div', { id: id, class: 'screen en-screen sp-screen sc-screen' }, [sea, el('div', { class: 'en-wrap en-wrap--card' }, [card])]);
        document.body.appendChild(s);
        return s;
    }
    function open(id) { if (typeof switchScreen === 'function') switchScreen(id); }
    function backToMap() { clearJoin(); open('screen-map'); }
    function fmt(iso) { return String(iso || '').replace('T', ' ').slice(0, 16); }

    async function call(payload, button) {
        if (!online()) return { status: 'offline', message: '目前是示範模式（沒有連到後端），這個功能需要連線後才能使用。' };
        if (st.busy || (typeof Loading !== 'undefined' && Loading.busy)) return null;
        st.busy = true; if (button) button.disabled = true;
        try {
            const r = await apiCall(payload);
            if (r && r.code === 'SESSION_INVALID' && AuthSession.student && typeof SessionGuard !== 'undefined') { SessionGuard.studentExpired(); return null; }
            return r || { status: 'error', message: '連線失敗，請檢查網路後再試一次' };
        } catch (e) { console.error(e); return { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; }
        finally { st.busy = false; if (button) button.disabled = false; }
    }

    /* ---------- 建立畫面 ---------- */
    function build() {
        if ($('screen-sc-join')) return;
        mkScreen('screen-sc-join', '加入班級（選填）', [
            para('加入班級是選填的。' + SELF_PLAY),
            field('scj-code', '班級代碼（向老師問，6 個字）', { maxlength: 8, upper: true, placeholder: '例如: K7M2QX' }),
            errLine('scj-msg'),
            btn('查看這個班級', 'ds-btn--sea', function () { doPreview(this); }, 'scj-preview'),
            el('div', { id: 'scj-detail', class: 'sc-detail', hidden: '' }, [
                el('p', { id: 'scj-class', class: 'tp-hello' }),
                el('p', { id: 'scj-who', class: 'tp-hint' }),
                el('blockquote', { id: 'scj-consent-text', class: 'tp-note sc-consent' }),
                el('p', { id: 'scj-leave-note', class: 'tp-hint', text: '你隨時可以離開班級；離開後，你的星星、獎勵、裝扮和學習紀錄都還在。' }),
                el('div', { id: 'scj-name-wrap', class: 'ds-field', hidden: '' }, [
                    el('label', { class: 'ds-label', for: 'scj-real', text: '你的本名（選填，只能填一次；老師用來認人）' }),
                    el('input', { type: 'text', id: 'scj-real', class: 'ds-input', maxlength: '20', autocomplete: 'off', spellcheck: 'false', placeholder: '2～20 個字' }),
                    el('p', { class: 'tp-hint', text: '填了之後，你自己就不能再改；如果寫錯了，請找老師更正。不填也可以加入。' })
                ]),
                checkRow('scj-agree', '我看完上面的說明了，同意加入'),
                btn('確認加入', 'ds-btn--gold', function () { doJoin(this); }, 'scj-confirm'),
                btn('了解如何保護我的帳號', 'ds-btn--sea', function () { if (typeof StudentPin !== 'undefined') StudentPin.openProtect('screen-sc-join'); }, 'scj-protect')
            ]),
            btn('稍後再說，自己冒險', 'ds-btn--ghost en-back', function () { backToMap(); }, 'scj-later')
        ]);
        mkScreen('screen-sc-class', '我的班級', [
            el('div', { id: 'scc-body' }),
            errLine('scc-msg'),
            btn('回到海圖', 'ds-btn--ghost en-back', function () { backToMap(); }, 'scc-back')
        ]);
    }

    function clearJoin() {
        const c = $('scj-code'); if (c) c.value = ''; const r = $('scj-real'); if (r) r.value = ''; const a = $('scj-agree'); if (a) a.checked = false;
        const d = $('scj-detail'); if (d) d.hidden = true; say('scj-msg', ''); st.preview = null; st.mode = ''; st.code = '';
    }

    /* ---------- 入口按鈕（海圖上的「加入班級（選填）」） ---------- */
    function syncButton() {
        const b = $('btn-class'); if (!b) return;
        const logged = online() && AuthSession.student && AuthSession.student.token && st.enabled;
        b.hidden = !logged;
        const full = $('btn-class-full'), inClass = st.info && st.info.membership;
        const label = !inClass ? '加入班級（選填）' : (st.info.membership.status === 'pending_share' ? '我的班級（等你決定）' : '我的班級');
        if (full) full.textContent = label;
        b.setAttribute('aria-label', label);
    }
    /* 登入後呼叫：問後端有沒有開班級功能；任何失敗都只是不顯示入口，不影響遊玩 */
    async function afterLogin(res) {
        st.info = null; st.enabled = false; syncButton();
        if (!online() || !AuthSession.student || !AuthSession.student.token) return;
        if (typeof StudentPin !== 'undefined' && StudentPin.classesEnabled && !StudentPin.classesEnabled()) return;
        try {
            const r = await apiCall({ action: 'get_student_class' });
            if (r && r.status === 'success' && r.enabled === true) { st.enabled = true; st.info = r; }
        } catch (e) { /* 入口不出現而已 */ }
        syncButton();
        warmTasks();
        /* 剛用啟用碼完成 PIN：若班級正等著學生決定要不要分享，直接帶到說明畫面（每次登入最多一次；可按「之後再決定」離開） */
        const justActivated = !!(res && res.notice && res.notice.type === 'activated');
        if (justActivated && !st.prompted && st.info && st.info.membership && st.info.membership.status === 'pending_share') { st.prompted = true; promptWhenOnMap(); }
    }
    /* 已加入班級的學生：背景讀一次任務清單，完成一區時才知道要不要提示（讀不到也沒關係，只是不預先知道） */
    function warmTasks() { try { if (st.enabled && st.info && st.info.membership && st.info.membership.status === 'active' && typeof StudentTasks !== 'undefined') StudentTasks.load(); } catch (e) { /* 不影響遊玩 */ } }
    /* 等學生從「要不要建立保護碼」那一步走到海圖，再帶到說明畫面（不打斷保護碼那一步）；學生可按「之後再決定」直接回海圖 */
    function promptWhenOnMap() {
        const map = $('screen-map'); if (!map) return;
        const go = function () { stopWatch(); setTimeout(function () { if (st.enabled && st.info && st.info.membership && st.info.membership.status === 'pending_share') openEntry(); }, 350); };
        if (map.classList.contains('active')) { go(); return; }
        if (typeof MutationObserver === 'undefined') return;
        stopWatch();
        st.watch = new MutationObserver(function () { if (map.classList.contains('active')) go(); });
        st.watch.observe(map, { attributes: true, attributeFilter: ['class'] });
    }
    function stopWatch() { if (st.watch) { try { st.watch.disconnect(); } catch (e) { /* ignore */ } st.watch = null; } }
    async function openEntry() {
        build(); renderClass(null); open('screen-sc-class');
        const r = await call({ action: 'get_student_class' }); if (!r) return;
        if (r.status === 'success' && r.enabled) { st.info = r; st.enabled = true; syncButton(); renderClass(r); warmTasks(); }
        else say('scc-msg', r.status === 'success' ? '班級功能目前還沒有開放。' : (r.message || '無法載入。'));
    }

    /* ---------- 我的班級 ---------- */
    function renderClass(info) {
        const body = $('scc-body'); if (!body) return; body.textContent = ''; say('scc-msg', '');
        if (!info) { body.appendChild(para('載入中…')); return; }
        const m = info.membership, pt = info.pending_transfer;
        if (m && m.status === 'active') {
            body.appendChild(para('你在：' + m.class_name + (m.archived ? '（老師已封存這個班級）' : ''), 'tp-hello'));
            body.appendChild(para('老師：' + (m.teacher_name || '') + (m.school_name ? '　學校：' + m.school_name : '')));
            body.appendChild(para('申請時間：' + (fmt(m.applied_at) || '（無）') + '　身分確認時間：' + (fmt(m.identity_confirmed_at) || '（無）') + '　同意分享時間：' + fmt(m.shared_at), 'tp-hint'));
            body.appendChild(para('這個班的老師可以看到你的學習進度與作答情形。你隨時可以離開班級，離開後你的星星、獎勵、裝扮和學習紀錄都還在。', 'tp-note'));
        } else if (m && m.status === 'pending_identity') {
            body.appendChild(para('已送出申請：' + m.class_name, 'tp-hello'));
            body.appendChild(para('申請時間：' + fmt(m.applied_at), 'tp-hint'));
            body.appendChild(para('等待 ' + (m.teacher_name || '老師') + ' 當面確認你是本人。確認之後，老師會給你一組啟用碼，你用它設定 PIN 來保護帳號。這時老師還是只看得到你的暱稱、稱號和帳號識別後四碼，看不到你的本名、星星數和學習資料；之後系統會再讓你看完說明，由你自己決定要不要分享。', 'tp-note'));
            if (info.scope === 'full') {
                body.appendChild(para('你的帳號已經有 PIN 保護。想加入的話，再輸入一次班級代碼，看完完整說明後由你自己決定要不要分享。', 'tp-hint'));
                body.appendChild(btn('輸入班級代碼，看說明', 'ds-btn--gold', function () { openJoin(); }, 'scc-confirm-join'));
            } else body.appendChild(btn('我有啟用碼', 'ds-btn--gold', function () { if (typeof StudentPin !== 'undefined') StudentPin.openActivate('screen-sc-class'); }, 'scc-activate'));
        } else if (m && m.status === 'pending_share') {
            renderShare(body, info, m);
        } else {
            body.appendChild(para('你還沒有加入班級。', 'tp-hello'));
            body.appendChild(para(SELF_PLAY, 'tp-note'));
            if (info.last_end) {
                const e = info.last_end;
                body.appendChild(para(e.by_teacher ? ('老師已經把你移出「' + e.class_name + '」（' + fmt(e.at) + '）。你的資料都還在，可以繼續自己冒險。') : ('你已經離開「' + e.class_name + '」（' + fmt(e.at) + '）。'), 'tp-hint'));
            }
        }
        body.appendChild(el('h2', { class: 'tp-hello', text: '老師任務' }));
        if (m && m.status === 'active' && typeof StudentTasks !== 'undefined') {
            body.appendChild(para('老師發布的任務可以在這裡查看。任務不會鎖住任何島嶼，你可以照常自己冒險。', 'tp-hint'));
            body.appendChild(btn('查看老師任務', 'ds-btn--sea', function () { StudentTasks.open(); }, 'scc-tasks'));
        } else body.appendChild(para('還沒有老師任務。' + (m ? '等你同意分享、正式加入班級後，老師發布的任務會出現在這裡。' : '輸入班級代碼加入班級後，老師發布的任務會出現在這裡。'), 'tp-hint'));
        if (pt) {
            body.appendChild(para('轉班申請：等待 ' + (pt.teacher_name || '老師') + ' 確認「' + pt.class_name + '」（' + fmt(pt.expires_at) + ' 前有效）。在老師確認之前，你仍然在原本的班級。', 'tp-note'));
            body.appendChild(btn('取消轉班申請', 'ds-btn--ghost', function () { doCancelTransfer(this); }, 'scc-cancel-transfer'));
        }
        if (m && m.status === 'pending_share') {
            body.appendChild(btn('之後再決定，先自己冒險', 'ds-btn--ghost', function () { backToMap(); }, 'scc-later-share'));
            body.appendChild(btn('不分享，結束這份申請', 'ds-btn--coral', function () { doDecline(this); }, 'scc-decline'));
        } else if (!m) body.appendChild(btn('輸入班級代碼加入', 'ds-btn--gold', function () { openJoin(); }, 'scc-join'));
        else if (m.status === 'active') {
            if (!pt) body.appendChild(btn('申請轉班', 'ds-btn--sea', function () { openJoin(); }, 'scc-transfer'));
            body.appendChild(checkRow('scc-leave-ok', '我確定要離開這個班級'));
            body.appendChild(btn('離開班級', 'ds-btn--coral', function () { doLeave(this); }, 'scc-leave'));
        } else if (m.status === 'pending_identity') {
            body.appendChild(checkRow('scc-leave-ok', '我要取消這份申請'));
            body.appendChild(btn('取消申請', 'ds-btn--coral', function () { doLeave(this); }, 'scc-leave'));
        }
    }
    /* 身分已確認、等學生決定要不要分享：完整說明（班級、老師、分享範圍、退出方式）＋三個選項（同意／之後再決定／不分享） */
    function renderShare(body, info, m) {
        const sh = info.share || {};
        body.appendChild(para('老師已確認你的身分，PIN 也設定好了', 'tp-hello'));
        body.appendChild(para('現在要不要把學習資料分享給老師，由你決定。', 'tp-note'));
        body.appendChild(para('班級：' + m.class_name, 'tp-hello'));
        body.appendChild(para('老師：' + (m.teacher_name || '') + (m.school_name ? '　學校：' + m.school_name : '')));
        body.appendChild(para('申請時間：' + (fmt(m.applied_at) || '（無）') + '　身分確認時間：' + (fmt(m.identity_confirmed_at) || '（無）') + '　同意分享：尚未', 'tp-hint'));
        body.appendChild(para('分享的範圍', 'tp-hello'));
        body.appendChild(el('blockquote', { id: 'scc-share-text', class: 'tp-note sc-consent', text: sh.consent_text || CONSENT_TEXT }));
        body.appendChild(para('現在老師只看得到你的暱稱、稱號和帳號識別後四碼，看不到你的本名、星星數和學習資料。' + (sh.exit_note || EXIT_NOTE), 'tp-hint'));
        if (!info.has_real_name) {
            body.appendChild(el('div', { class: 'ds-field' }, [
                el('label', { class: 'ds-label', for: 'scc-real', text: '你的本名（選填，只能填一次；老師用來認人）' }),
                el('input', { type: 'text', id: 'scc-real', class: 'ds-input', maxlength: '20', autocomplete: 'off', spellcheck: 'false', placeholder: '2～20 個字' }),
                el('p', { class: 'tp-hint', text: '不填也可以分享；老師會用暱稱和帳號識別來認你。' })
            ]));
        }
        body.appendChild(checkRow('scc-share-agree', '我看完上面的說明了，同意分享學習資料給這位老師'));
        const c = btn('同意分享，正式加入', 'ds-btn--gold', function () { doConfirmShare(this, m.member_id); }, 'scc-share-confirm');
        body.appendChild(c);
    }
    async function doConfirmShare(b, memberId) {
        say('scc-msg', '');
        const ag = $('scc-share-agree'); if (!ag || !ag.checked) { say('scc-msg', '請先看完說明並勾選同意。'); return; }
        const payload = { action: 'confirm_class_share', member_id: memberId, consent: true };
        const re = $('scc-real');
        if (re && re.value.trim()) { const real = re.value.trim(); if (real.length < 2 || real.length > 20) { say('scc-msg', '本名要 2～20 個字，或不填。'); return; } payload.real_name = real; }
        const r = await call(payload, b); if (!r) return;
        if (r.status !== 'success') { say('scc-msg', r.message || '無法完成，請稍後再試。'); return; }
        await openEntry(); say('scc-msg', '已同意分享，你已加入「' + (r.class_name || '') + '」。');
    }
    async function doDecline(b) {
        say('scc-msg', '');
        const r = await call({ action: 'leave_class', confirm: true }, b); if (!r) return;
        if (r.status !== 'success') { say('scc-msg', r.message || '無法完成，請稍後再試。'); return; }
        await openEntry(); say('scc-msg', '好的，沒有分享任何資料給老師。你的 PIN 和冒險都還在，可以繼續玩。');
    }
    async function doLeave(b) {
        const ok = $('scc-leave-ok'); say('scc-msg', '');
        if (!ok || !ok.checked) { say('scc-msg', '請先勾選確認。'); return; }
        const r = await call({ action: 'leave_class', confirm: true }, b); if (!r) return;
        if (r.status !== 'success') { say('scc-msg', r.message || '無法離開，請稍後再試。'); return; }
        await openEntry(); say('scc-msg', r.note || '已離開班級。');
    }
    async function doCancelTransfer(b) {
        const r = await call({ action: 'cancel_class_transfer' }, b); if (!r) return;
        if (r.status !== 'success') { say('scc-msg', r.message || '無法取消。'); return; }
        await openEntry(); say('scc-msg', '已取消轉班申請，你仍在原本的班級。');
    }

    /* ---------- 加入／轉班 ---------- */
    function openJoin() { build(); clearJoin(); open('screen-sc-join'); }
    async function doPreview(b) {
        say('scj-msg', '');
        const code = val('scj-code').trim();
        if (!code) { say('scj-msg', '請輸入班級代碼。'); return; }
        const r = await call({ action: 'preview_class_by_code', class_code: code }, b); if (!r) return;
        if (r.status !== 'success') { st.preview = null; $('scj-detail').hidden = true; say('scj-msg', r.message || '找不到這個班級。'); return; }
        st.preview = r; st.mode = r.mode; st.code = code;
        showPreview(r);
    }
    function showPreview(r) {
        const d = $('scj-detail'); d.hidden = false;
        say('scj-class', r.class_name + (r.school_year ? '（' + r.school_year + ' 學年度）' : ''));
        say('scj-who', '老師：' + r.teacher_name + (r.school_name ? '　學校：' + r.school_name : ''));
        const needPin = r.mode === 'need_pin', already = r.mode === 'already', pendOther = r.mode === 'pending_other';
        const text = needPin ? r.message : (already ? '你已經在這個班級（或已送出申請）了。' : (pendOther ? '你已經向另一個班級送出申請了，請先取消那份申請。' : (r.mode === 'apply' ? r.apply_notice : (r.consent_text || CONSENT_TEXT))));
        say('scj-consent-text', text);
        const act = r.mode === 'join' || r.mode === 'transfer' || r.mode === 'apply';
        $('scj-leave-note').hidden = !act;
        $('scj-name-wrap').hidden = !(r.mode === 'join' && r.needs_real_name);
        $('scj-agree').parentNode.hidden = !act;
        const cb = $('scj-agree'); cb.checked = false;
        const lab = cb.parentNode.querySelector('span'); if (lab) lab.textContent = r.mode === 'apply' ? '我明白了，送出申請' : (r.mode === 'transfer' ? '我看完上面的說明了，同意申請轉班' : '我看完上面的說明了，同意加入');
        const c = $('scj-confirm'); c.hidden = !act; c.textContent = r.mode === 'apply' ? '送出申請' : (r.mode === 'transfer' ? '送出轉班申請' : '確認加入');
        $('scj-protect').hidden = !needPin;
    }
    async function doJoin(b) {
        say('scj-msg', '');
        if (!st.preview || !$('scj-agree').checked) { say('scj-msg', '請先看完說明並勾選確認。'); return; }
        const mode = st.mode, code = st.code;
        const payload = { action: mode === 'transfer' ? 'request_class_transfer' : 'join_class', class_code: code, consent: true };
        if (mode === 'join' && st.preview.needs_real_name) {
            const real = val('scj-real').trim();
            if (real) { if (real.length < 2 || real.length > 20) { say('scj-msg', '本名要 2～20 個字，或不填。'); return; } payload.real_name = real; }
        }
        const r = await call(payload, b); if (!r) return;
        if (r.status !== 'success') { say('scj-msg', r.message || '無法完成，請稍後再試。'); return; }
        clearJoin();
        await openEntry();
        say('scc-msg', mode === 'transfer' ? '已送出轉班申請，等老師確認。' : (mode === 'apply' ? '已送出申請，請等老師當面確認你是本人。' : '已加入班級。'));
    }

    function reset() {
        st.info = null; st.preview = null; st.mode = ''; st.enabled = false; st.busy = false; st.code = ''; st.prompted = false; stopWatch();
        ['scj-code', 'scj-real'].forEach(function (id) { const e = $(id); if (e) e.value = ''; });
        const b = $('btn-class'); if (b) b.hidden = true;
        const d = $('scj-detail'); if (d) d.hidden = true;
        const body = $('scc-body'); if (body) body.textContent = '';
    }

    return { afterLogin: afterLogin, openEntry: openEntry, openJoin: openJoin, reset: reset, sync: syncButton, _state: st };
})();
