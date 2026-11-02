/* 階段 9C：教師班級管理（建立班級、班級代碼、學生名單、轉班申請、移除學生、本名更正、匯出），
   以及「管理員確認」教師的當面確認功能（核發啟用碼、重設 PIN、作廢）。
   * 全部畫面由這支程式建立；後端傳來的文字一律用 textContent 寫入，不當成 HTML。
   * 啟用碼與臨時 PIN 只顯示一次，離開畫面就清除；不寫入 localStorage／sessionStorage／Cookie。
   * 教師看到的學生範圍完全由後端決定（visibleScope_）：這裡只顯示後端給的欄位，畫面沒有任何找出班外學生、或替學生入班的功能。
   * 學生的登入代碼與完整學號不會傳到這裡。 */
const TeacherClass = (function () {
    const $ = function (id) { return document.getElementById(id); };
    const token = function () { return (AuthSession.teacher && AuthSession.teacher.token) || ''; };
    const st = { list: null, cls: null, roster: null, tab: 'students', busy: false, verified: false, l2: null, panel: null };

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
    function para(text, cls) { return el('p', { class: cls || 'tp-hint', text: text }); }
    function btn(label, cls, fn, id) { const b = el('button', { type: 'button', class: 'ds-btn ' + cls + ' ds-btn--sm', text: label }); if (id) b.id = id; b.addEventListener('click', fn); return b; }
    function vbtn(label, fn, id) { const b = el('button', { type: 'button', class: 'btn-view', text: label }); if (id) b.id = id; b.addEventListener('click', fn); return b; }
    function errLine(id) { return el('p', { id: id, class: 'ds-error en-error', role: 'alert' }); }
    function checkRow(id, text) { return el('label', { class: 'tp-check', for: id }, [el('input', { type: 'checkbox', id: id }), el('span', { text: text })]); }
    function radioRow(name, value, text, id) { return el('label', { class: 'tp-radio', for: id }, [el('input', { type: 'radio', name: name, value: value, id: id }), el('span', { text: text })]); }
    function inputRow(id, label, opt) {
        opt = opt || {};
        const props = { type: 'text', id: id, class: 'ds-input', autocomplete: 'off', spellcheck: 'false' };
        if (opt.maxlength) props.maxlength = String(opt.maxlength);
        if (opt.placeholder) props.placeholder = opt.placeholder;
        return el('div', { class: 'ds-field' }, [el('label', { class: 'ds-label', for: id, text: label }), el('input', props)]);
    }
    function fmt(iso) { return String(iso || '').replace('T', ' ').slice(0, 16); }
    function td(tr, text, cls) { const c = el('td', { text: text === undefined || text === null ? '' : String(text) }); if (cls) c.className = cls; tr.appendChild(c); return c; }
    function titleOf(stars) { try { return ProgressSystem.getTitle(stars).title; } catch (e) { return ''; } }

    function mkScreen(id, title, body) {
        if ($(id)) return $(id);
        const sea = el('div', { class: 'en-sea', 'aria-hidden': 'true' }, [el('i', { class: 'en-sun' }), el('i', { class: 'en-cloud en-cloud--1' }), el('i', { class: 'en-cloud en-cloud--2' }), el('i', { class: 'en-waves' })]);
        const card = el('div', { class: 'ds-card ds-card--canvas en-card sp-card tc-card' }, [el('h1', { class: 'ds-plank en-card__title', id: id + '-title', text: title })].concat(body));
        const s = el('div', { id: id, class: 'screen en-screen sp-screen tc-screen' }, [sea, el('div', { class: 'en-wrap en-wrap--card tc-wrap' }, [card])]);
        document.body.appendChild(s);
        return s;
    }
    function open(id) { if (typeof switchScreen === 'function') switchScreen(id); }
    function lost() { if (typeof TeacherPortal !== 'undefined' && TeacherPortal.sessionLost) TeacherPortal.sessionLost(); }

    async function call(payload, msgId) {
        if (typeof GAS_URL !== 'string' || GAS_URL.indexOf('http') !== 0) { say(msgId || 'tcl-msg', '目前是示範模式（沒有連到後端），班級功能需要連線後才能使用。'); return null; }
        if (!AuthSession.teacher) { lost(); return null; }
        if (st.busy || (typeof Loading !== 'undefined' && Loading.busy)) { say(msgId || 'tcl-msg', '上一個動作還在處理中，請稍候再按一次。'); return null; }
        st.busy = true;
        try {
            const r = await apiCall(Object.assign({ token: token() }, payload));
            if (r && r.code === 'SESSION_INVALID') { lost(); return null; }
            return r || { status: 'error', message: '連線失敗，請檢查網路後再試一次' };
        } catch (e) { console.error(e); return { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; }
        finally { st.busy = false; }
    }

    /* ---------- 班級清單畫面 ---------- */
    function build() {
        if ($('screen-tc-list')) return;
        mkScreen('screen-tc-list', '我的班級', [
            para('學生要自己輸入班級代碼並按確認，才會加入你的班級；你沒有辦法把學生加進班級，也搜尋不到沒加入的學生。'),
            el('div', { id: 'tcl-limits', class: 'tp-note' }),
            el('div', { id: 'tcl-create', class: 'tc-form' }, [
                inputRow('tcl-name', '班級名稱（1～20 個字）', { maxlength: 20, placeholder: '例如: 三年一班' }),
                inputRow('tcl-school', '學校名稱（選填，預設用你的學校）', { maxlength: 40 }),
                inputRow('tcl-year', '學年度（選填，例如 115）', { maxlength: 4 }),
                btn('建立班級', 'ds-btn--gold', function () { doCreate(this); }, 'tcl-create-btn')
            ]),
            errLine('tcl-msg'),
            el('div', { id: 'tcl-list', class: 'tc-cards' }),
            el('div', { id: 'tcl-xfer' }),
            btn('回教師首頁', 'ds-btn--ghost en-back', function () { open('screen-teacher-home'); }, 'tcl-back')
        ]);
        mkScreen('screen-tc-class', '班級', [
            el('div', { id: 'tcc-head' }),
            errLine('tcc-msg'),
            el('div', { id: 'tcc-tools', class: 'tc-tools' }),
            el('div', { id: 'tcc-tabs', class: 'tc-tabs', role: 'tablist', 'aria-label': '學生名單分類' }),
            el('div', { id: 'tcc-table-wrap', class: 'td-scroll', role: 'region', 'aria-label': '學生名單', tabindex: '0' }),
            el('div', { id: 'tcc-panel', class: 'tc-panel', hidden: '' }),
            btn('回班級清單', 'ds-btn--ghost en-back', function () { openList(); }, 'tcc-back')
        ]);
    }

    function openFromHome() { build(); openList(); }
    async function openList() {
        build(); closePanel(); say('tcl-msg', ''); open('screen-tc-list');
        const r = await call({ action: 'list_teacher_classes' }, 'tcl-msg'); if (!r) return;
        if (r.status !== 'success') {
            const off = r.code === 'FEATURE_OFF' || r.code === 'SCHEMA_NOT_READY';
            $('tcl-create').hidden = off; $('tcl-list').textContent = ''; $('tcl-limits').textContent = '';
            say('tcl-msg', off ? '班級功能目前還沒有開放。請管理員確認後再使用。' : (r.message || '無法載入班級。')); return;
        }
        $('tcl-create').hidden = false;
        st.list = r; st.verified = !!r.verified; st.l2 = r.l2 || null;
        say('tcl-limits', '每位教師最多 ' + r.limits.max_active + ' 個使用中班級，每小時最多建立 ' + r.limits.max_per_hour + ' 個。不用的班級可以先封存。' + (st.verified ? '　你是「管理員確認」的教師：可以當面確認你班上學生的身分（今日已用 ' + (st.l2 ? st.l2.used_today : 0) + ' / ' + (st.l2 ? st.l2.daily_max : 20) + ' 組）。' : ''));
        const sc = $('tcl-school'); if (sc && !sc.value && typeof TeacherPortal !== 'undefined') { const t = TeacherPortal.getTeacher(); sc.placeholder = t && t.school_name ? t.school_name : ''; }
        renderList(r.classes || []);
        loadTransfers();
    }
    function renderList(classes) {
        const box = $('tcl-list'); box.textContent = '';
        if (!classes.length) { box.appendChild(para('你還沒有建立班級。建立後，把班級代碼告訴學生，學生自己輸入並確認後才會加入。', 'tp-note')); return; }
        classes.forEach(function (c) {
            const archived = c.status === 'archived';
            const card = el('div', { class: 'tc-class' + (archived ? ' is-archived' : ''), 'data-class-id': c.class_id }, [
                el('h2', { class: 'tp-hello', text: c.class_name + (archived ? '（已封存）' : '') }),
                el('p', { class: 'tp-hint', text: [c.school_name, c.school_year ? c.school_year + ' 學年度' : ''].filter(Boolean).join('　') }),
                el('p', { class: 'tc-code-line' }, [document.createTextNode('班級代碼　'), el('code', { class: 'sp-code tc-code', text: c.class_code })]),
                el('p', { class: 'tp-hint', text: '已加入 ' + c.active_count + ' 人　待確認身分 ' + c.pending_count + ' 人　待學生同意分享 ' + (c.share_pending_count || 0) + ' 人　已離班 ' + c.left_count + ' 人' + (c.pending_transfers ? '　轉班申請 ' + c.pending_transfers + ' 件' : '') })
            ]);
            card.appendChild(btn('開啟', 'ds-btn--sea', function () { openClass(c.class_id); }, 'tcl-open-' + c.class_id));
            box.appendChild(card);
        });
    }
    async function doCreate(b) {
        say('tcl-msg', '');
        const name = val('tcl-name').trim(); if (!name) { say('tcl-msg', '請輸入班級名稱。'); return; }
        const payload = { action: 'create_class', class_name: name };
        const school = val('tcl-school').trim(); if (school) payload.school_name = school;
        const year = val('tcl-year').trim(); if (year) payload.school_year = year;
        b.disabled = true; const r = await call(payload, 'tcl-msg'); b.disabled = false; if (!r) return;
        if (r.status !== 'success') { say('tcl-msg', r.message || '無法建立班級。'); return; }
        ['tcl-name', 'tcl-school', 'tcl-year'].forEach(function (id) { const e = $(id); if (e) e.value = ''; });
        await openList(); say('tcl-msg', '已建立「' + r.class.class_name + '」。把班級代碼告訴學生就可以了。');
    }

    /* ---------- 轉班申請 ---------- */
    async function loadTransfers() {
        const box = $('tcl-xfer'); if (!box) return; box.textContent = '';
        const r = await call({ action: 'list_transfer_requests' }, 'tcl-msg'); if (!r || r.status !== 'success') return;
        const reqs = r.requests || []; if (!reqs.length) return;
        box.appendChild(el('h2', { class: 'tp-hello', text: '轉班申請（' + reqs.length + '）' }));
        box.appendChild(para('這些學生想從別的班轉到你的班。核准之前，你只看得到暱稱、稱號和帳號識別，看不到本名、星星數與學習資料。', 'tp-hint'));
        reqs.forEach(function (q) {
            const s = q.student;
            const row = el('div', { class: 'tc-req', 'data-request-id': q.request_id }, [
                el('span', { class: 'tc-req__who', text: s.nickname + '｜' + s.id_last4 + '｜' + (s.title || '') + '　→　' + q.class_name + '（' + fmt(q.expires_at) + ' 前有效）' })
            ]);
            row.appendChild(vbtn('核准', function () { decide(q.request_id, 'approve'); }, 'tcx-approve-' + q.request_id));
            row.appendChild(vbtn('拒絕', function () { decide(q.request_id, 'reject'); }, 'tcx-reject-' + q.request_id));
            box.appendChild(row);
        });
    }
    async function decide(requestId, decision) {
        const r = await call({ action: 'decide_transfer_request', request_id: requestId, decision: decision }, 'tcl-msg'); if (!r) return;
        if (r.status !== 'success') say('tcl-msg', r.message || '無法處理。'); else say('tcl-msg', decision === 'approve' ? '已核准，學生已轉入你的班級。' : '已拒絕，學生仍在原本的班級。');
        if ($('screen-tc-class').classList.contains('active')) { await openClass(st.cls.class_id, true); } else { await openList(); say('tcl-msg', decision === 'approve' && r.status === 'success' ? '已核准，學生已轉入你的班級。' : (r.status === 'success' ? '已拒絕，學生仍在原本的班級。' : (r.message || '無法處理。'))); }
    }

    /* ---------- 單一班級 ---------- */
    async function openClass(classId, keepTab) {
        build(); closePanel(); say('tcc-msg', ''); if (!keepTab) st.tab = 'students'; open('screen-tc-class');
        const r = await call({ action: 'list_class_students', class_id: classId }, 'tcc-msg'); if (!r) return;
        if (r.status !== 'success') { say('tcc-msg', r.message || '無法載入名單。'); return; }
        st.cls = r.class; st.roster = r; st.verified = !!r.can_manage_identity;
        renderClassHead(); renderTabs(); renderTable();
    }
    function renderClassHead() {
        const c = st.cls, head = $('tcc-head'); head.textContent = '';
        say('screen-tc-class-title', c.class_name + (c.status === 'archived' ? '（已封存）' : ''));
        head.appendChild(para([c.school_name, c.school_year ? c.school_year + ' 學年度' : ''].filter(Boolean).join('　'), 'tp-hint'));
        head.appendChild(el('p', { class: 'tc-code-line' }, [document.createTextNode('班級代碼　'), el('code', { id: 'tcc-code', class: 'sp-code tc-code', text: c.class_code })]));
        head.appendChild(para('學生輸入這個代碼、看完說明並按確認，才會加入。更新代碼後，舊代碼立即失效；已經加入的學生不受影響。', 'tp-hint'));
        const tools = $('tcc-tools'); tools.textContent = '';
        if (c.status === 'active') {
            tools.appendChild(vbtn('更新班級代碼', function () { askConfirm('更新後，舊的班級代碼會立刻失效。確定要更新嗎？', '確定更新', regen); }, 'tcc-regen'));
            tools.appendChild(vbtn('編輯班級資料', function () { editPanel(); }, 'tcc-edit'));
            tools.appendChild(vbtn('封存班級', function () { askConfirm('封存後，學生就不能再用這個代碼加入，你仍可查看名單。確定要封存嗎？', '確定封存', archive); }, 'tcc-archive'));
        } else tools.appendChild(vbtn('還原班級', function () { restore(); }, 'tcc-restore'));
        tools.appendChild(vbtn('老師任務', function () { if (typeof TeacherTasks !== 'undefined') TeacherTasks.open(st.cls); }, 'tcc-tasks'));
        tools.appendChild(vbtn('匯出名單（CSV）', function () { doExport(); }, 'tcc-export'));
    }
    function renderTabs() {
        const r = st.roster, tabs = $('tcc-tabs'); tabs.textContent = '';
        const live = r.students.filter(function (s) { return s.status === 'active'; }), pend = r.students.filter(function (s) { return s.status === 'pending_identity'; }), shr = r.students.filter(function (s) { return s.status === 'pending_share'; }), xfer = r.students.filter(function (s) { return s.status === 'pending_transfer'; });
        const defs = [['students', '已加入（' + live.length + '）'], ['pending', '待確認身分（' + pend.length + '）'], ['share', '待學生同意分享（' + shr.length + '）'], ['transfer', '轉班申請（' + xfer.length + '）'], ['left', '已離班（僅任務結果）（' + r.left.length + '）']];
        defs.forEach(function (d) {
            const b = el('button', { type: 'button', role: 'tab', class: 'tc-tab' + (st.tab === d[0] ? ' is-on' : ''), 'aria-selected': st.tab === d[0] ? 'true' : 'false', id: 'tcc-tab-' + d[0], text: d[1] });
            b.addEventListener('click', function () { st.tab = d[0]; closePanel(); renderTabs(); renderTable(); });
            tabs.appendChild(b);
        });
    }
    function renderTable() {
        const wrap = $('tcc-table-wrap'); wrap.textContent = '';
        const r = st.roster, tab = st.tab;
        const rows = tab === 'left' ? r.left : r.students.filter(function (s) { return tab === 'students' ? s.status === 'active' : (tab === 'pending' ? s.status === 'pending_identity' : (tab === 'share' ? s.status === 'pending_share' : s.status === 'pending_transfer')); });
        if (!rows.length) {
            const msg = { students: '還沒有學生加入。把班級代碼告訴學生，學生自己輸入並確認後，會出現在這裡。', pending: '目前沒有等待確認身分的學生。', share: '目前沒有等學生同意分享的學生。',  transfer: '目前沒有轉班申請。', left: '還沒有離班的學生。' }[tab];
            wrap.appendChild(para(msg, 'tp-note')); return;
        }
        if (tab === 'left') wrap.appendChild(para(r.left_note || '', 'tp-hint'));
        const table = el('table', { class: 'admin-table compact', 'data-tab': tab });
        const head = el('tr'); (tab === 'left' ? ['狀態', '加入時間', '離班時間', '原因'] : ['本名', '暱稱', '帳號識別', '稱號', '星星', st.tab === 'students' ? '最後登入' : '狀態', '操作']).forEach(function (h) { head.appendChild(el('th', { text: h })); });
        table.appendChild(el('thead', null, [head]));
        const body = el('tbody');
        rows.forEach(function (s) {
            const tr = el('tr', { 'data-member-id': s.member_id || '' });
            if (tab === 'left') {
                const L = { left: '已離班', removed: '已被移除', transferred: '已轉班' };
                td(tr, L[s.status] || s.status); td(tr, fmt(s.joined_at)); td(tr, fmt(s.left_at)); td(tr, { student_left: '學生自己離班', removed_by_teacher: '老師移除', transferred: '轉班', cancelled: '取消申請', declined_share: '學生不同意分享', superseded: '改加入其他班' }[s.left_reason] || s.left_reason);
            } else {
                if (s.scope === 'full') { td(tr, s.real_name || '（尚未填寫）', s.real_name ? '' : 'tc-missing'); } else { td(tr, '同意分享後才顯示', 'tc-missing'); }
                td(tr, s.nickname); td(tr, s.id_last4); td(tr, s.title || ''); td(tr, s.scope === 'full' ? s.total_stars + ' / 54' : '同意分享後才顯示', s.scope === 'full' ? '' : 'tc-missing');
                td(tr, s.status === 'active' ? fmt(s.last_login_at) : (s.status === 'pending_identity' ? (s.has_code ? '已核發啟用碼（' + fmt(s.code_expires_at) + ' 前）' : '等待當面確認') : (s.status === 'pending_share' ? '身分已確認（' + fmt(s.identity_confirmed_at) + '），等學生同意分享' : '等待你核准')));
                const act = el('td'); const box = el('div', { class: 'atp-act' });
                if (s.status === 'active') {
                    box.appendChild(vbtn('查看', function () { showDetail(s); }, 'tcc-view-' + s.member_id));
                    box.appendChild(vbtn('更正本名', function () { namePanel(s); }, 'tcc-name-' + s.member_id));
                    if (st.verified) {
                        if (s.pin === 'none') box.appendChild(vbtn('當面確認並核發啟用碼', function () { identityPanel(s, 'issue_activation_code'); }, 'tcc-issue-' + s.member_id));
                        if (s.pin === 'set') box.appendChild(vbtn('重設 PIN', function () { identityPanel(s, 'reset_student_pin'); }, 'tcc-reset-' + s.member_id));
                        if (s.has_code) box.appendChild(vbtn('作廢啟用碼', function () { revoke(s); }, 'tcc-revoke-' + s.member_id));
                    }
                    box.appendChild(vbtn('移除', function () { removePanel(s); }, 'tcc-remove-' + s.member_id));
                } else if (s.status === 'pending_identity') {
                    if (st.verified) {
                        box.appendChild(vbtn('當面確認並核發啟用碼', function () { identityPanel(s, 'approve_pending_identity'); }, 'tcc-approve-' + s.member_id));
                        if (s.has_code) box.appendChild(vbtn('作廢啟用碼', function () { revoke(s); }, 'tcc-revoke-' + s.member_id));
                    } else box.appendChild(para('需要由「管理員確認」的老師或管理員當面確認身分。', 'tp-hint'));
                    box.appendChild(vbtn('移除', function () { removePanel(s); }, 'tcc-remove-' + s.member_id));
                } else if (s.status === 'pending_share') {
                    box.appendChild(para('學生同意前，你只看得到暱稱、稱號與帳號識別，看不到本名、星星數與學習資料。', 'tp-hint'));
                    box.appendChild(vbtn('移除', function () { removePanel(s); }, 'tcc-remove-' + s.member_id));
                } else if (s.status === 'pending_transfer') {
                    box.appendChild(para('請到「我的班級」頁面的轉班申請處理。', 'tp-hint'));
                }
                act.appendChild(box); tr.appendChild(act);
            }
            body.appendChild(tr);
        });
        table.appendChild(body); wrap.appendChild(table);
    }

    /* ---------- 下方操作面板 ---------- */
    function closePanel() { st.panel = null; const p = $('tcc-panel'); if (p) { p.hidden = true; p.textContent = ''; } }
    function openPanel(title, kids) {
        const p = $('tcc-panel'); p.textContent = ''; p.hidden = false; st.panel = title;
        p.appendChild(el('h2', { class: 'tp-hello', text: title }));
        kids.forEach(function (k) { p.appendChild(k); });
        p.appendChild(errLine('tcp-msg'));
        p.scrollIntoView && p.scrollIntoView({ block: 'nearest' });
    }
    function askConfirm(text, yesLabel, fn) {
        openPanel('請確認', [para(text, 'tp-note'), el('div', { class: 'atp-act' }, [btn(yesLabel, 'ds-btn--coral', function () { fn(); }, 'tcp-yes'), btn('取消', 'ds-btn--ghost', function () { closePanel(); }, 'tcp-no')])]);
    }
    async function regen() {
        const r = await call({ action: 'regenerate_class_code', class_id: st.cls.class_id }, 'tcc-msg'); closePanel(); if (!r) return;
        if (r.status !== 'success') { say('tcc-msg', r.message || '無法更新。'); return; }
        await openClass(st.cls.class_id, true); say('tcc-msg', '已更新班級代碼。舊代碼已失效。');
    }
    async function archive() {
        const r = await call({ action: 'archive_class', class_id: st.cls.class_id }, 'tcc-msg'); closePanel(); if (!r) return;
        if (r.status !== 'success') { say('tcc-msg', r.message || '無法封存。'); return; }
        await openClass(st.cls.class_id, true); say('tcc-msg', '已封存。');
    }
    async function restore() {
        const r = await call({ action: 'restore_class', class_id: st.cls.class_id }, 'tcc-msg'); if (!r) return;
        if (r.status !== 'success') { say('tcc-msg', r.message || '無法還原。'); return; }
        await openClass(st.cls.class_id, true); say('tcc-msg', '已還原。');
    }
    function editPanel() {
        const c = st.cls;
        openPanel('編輯班級資料', [inputRow('tcp-cn', '班級名稱', { maxlength: 20 }), inputRow('tcp-sn', '學校名稱', { maxlength: 40 }), inputRow('tcp-sy', '學年度（例如 115）', { maxlength: 4 }),
            el('div', { class: 'atp-act' }, [btn('儲存', 'ds-btn--gold', function () { saveEdit(); }, 'tcp-save'), btn('取消', 'ds-btn--ghost', function () { closePanel(); }, 'tcp-no')])]);
        $('tcp-cn').value = c.class_name; $('tcp-sn').value = c.school_name || ''; $('tcp-sy').value = c.school_year || '';
    }
    async function saveEdit() {
        const r = await call({ action: 'update_class', class_id: st.cls.class_id, class_name: val('tcp-cn').trim(), school_name: val('tcp-sn').trim(), school_year: val('tcp-sy').trim() }, 'tcp-msg'); if (!r) return;
        if (r.status !== 'success') { say('tcp-msg', r.message || '無法儲存。'); return; }
        await openClass(st.cls.class_id, true); say('tcc-msg', '已儲存。');
    }

    /* ---------- 星星紀錄提醒（階段 9F-1）：只在「查看學生」明細、完整範圍顯示；只讀後端附的 star_check，不呼叫任何新 action、不寫入、不影響星星與獎勵 ----------
       用語規定：只說「需要確認／未發現需要確認／無法判斷」，不下任何對學生的判斷；後端附的固定說明句不顯示，改用下面核准前的固定說明。 */
    const SC_ZONE = { LEARNING: '學習', PRACTICE: '練習', MASTERY: '精熟' };
    const SC_NOTE = '僅供教學參考，不影響星星及獎勵';
    function scText(v, max) { return typeof v === 'string' ? v.slice(0, max || 20) : ''; }
    function starCheckBlock(c) {
        if (!c || typeof c !== 'object') return null;
        const state = c.state; if (state !== 'ok' && state !== 'check' && state !== 'unknown') return null;
        const reasons = Array.isArray(c.reasons) ? c.reasons : [];
        const ico = el('span', { class: 'tp-star__ico', 'aria-hidden': 'true' }, [el('span', { 'data-icon': 'info', 'data-size': '26' })]);
        const h = el('h3', { class: 'tp-star__h', id: 'tp-star-h' }, [ico, el('span', { text: state === 'check' ? '星星紀錄需要確認' : '星星紀錄' })]);
        const box = el('section', { class: 'tp-star tp-star--' + state, id: 'tp-star', role: 'note', 'aria-labelledby': 'tp-star-h' }, [h]);
        if (state === 'ok') box.appendChild(el('p', { class: 'tp-star__p', text: '目前未發現需要確認的項目' }));
        else if (state === 'unknown') box.appendChild(el('p', { class: 'tp-star__p', text: '目前無法判斷（資料表讀不到或紀錄太多），不代表有問題。' }));
        else {
            const ul = el('ul', { class: 'tp-star__list' }); let n = 0;
            reasons.forEach(function (x) {
                if (!x || typeof x !== 'object') return;
                if (x.code === 'total_mismatch') { ul.appendChild(el('li', { text: '總星數和各島星星加起來不一致' })); n++; }
                else if (x.code === 'no_record') { ul.appendChild(el('li', { text: scText(x.island) + '・' + (SC_ZONE[x.zone] || '') + '：進度有星星，但找不到對應的作答紀錄' })); n++; }
            });
            box.appendChild(el('p', { class: 'tp-star__p', text: '有 ' + n + ' 處需要老師看一下：' })); box.appendChild(ul);
            if (reasons.length >= 12) box.appendChild(el('p', { class: 'tp-star__p', text: '這裡最多列出 12 項，可能還有其他項目。' }));
            box.appendChild(el('p', { class: 'tp-star__p', text: '可能的原因（不代表有問題）：舊版資料沒有留下作答紀錄、進度曾被調整、資料搬移前的紀錄。請依實際情況判斷，必要時當面確認。' }));
        }
        box.appendChild(el('p', { class: 'tp-star__fixed', text: SC_NOTE }));
        try { if (typeof UIKit !== 'undefined' && UIKit.hydrate) UIKit.hydrate(box); } catch (e) { /* 只是圖示；失敗仍有文字 */ }
        return box;
    }

    /* ---------- 查看學生（依後端給的範圍） ---------- */
    async function showDetail(s) {
        openPanel('查看學生', [para('載入中…')]);
        const r = await call({ action: 'get_class_student_detail', class_id: st.cls.class_id, member_id: s.member_id }, 'tcp-msg'); if (!r) return;
        if (r.status !== 'success') { openPanel('查看學生', [para(r.message || '無法載入。', 'tp-note')]); return; }
        const v = r.student, kids = [];
        kids.push(para(r.scope === 'full'
            ? (v.real_name || '（尚未填寫姓名）') + '｜' + v.nickname + '｜' + v.id_last4 + '｜' + (v.title || '') + '｜' + v.total_stars + ' / 54 星'
            : v.nickname + '｜' + v.id_last4 + '｜' + (v.title || ''), 'tp-hello'));
        if (r.scope !== 'full') { kids.push(para(r.note || '', 'tp-note')); }
        else {
            const scb = starCheckBlock(r.star_check); if (scb) kids.push(scb);
            const t = el('table', { class: 'admin-table compact' }); const h = el('tr'); ['島嶼', '學習（星）', '練習（星）', '精熟（星）'].forEach(function (x) { h.appendChild(el('th', { text: x })); }); t.appendChild(el('thead', null, [h]));
            const tb = el('tbody'); (v.progress || []).forEach(function (p) { const tr = el('tr'); td(tr, p.island); td(tr, p.learning); td(tr, p.practice); td(tr, p.mastery); tb.appendChild(tr); }); t.appendChild(tb);
            kids.push(el('div', { class: 'td-scroll', tabindex: '0', role: 'region', 'aria-label': '各島星星' }, [t]));
            kids.push(para('最近的作答（最多 ' + (r.logs || []).length + ' 筆，共 ' + (r.logs_total || 0) + ' 筆）：', 'tp-hello'));
            const lt = el('table', { class: 'admin-table compact' }); const lh = el('tr'); ['時間', '島嶼', '階段', '題目', '學生答案', '結果'].forEach(function (x) { lh.appendChild(el('th', { text: x })); }); lt.appendChild(el('thead', null, [lh]));
            const lb = el('tbody'); (r.logs || []).forEach(function (l) { const tr = el('tr'); td(tr, fmt(l.answered_at)); td(tr, l.island); td(tr, l.stage); td(tr, l.question_text); td(tr, l.student_answer); td(tr, String(l.is_correct) === 'true' || l.is_correct === true ? '答對' : '答錯'); lb.appendChild(tr); }); lt.appendChild(lb);
            kids.push(el('div', { class: 'td-scroll', tabindex: '0', role: 'region', 'aria-label': '最近作答' }, [lt]));
        }
        kids.push(btn('關閉', 'ds-btn--ghost', function () { closePanel(); }, 'tcp-no'));
        openPanel('查看學生', kids);
    }

    function namePanel(s) {
        openPanel('更正本名', [para('只能更正你班上學生的本名；每次更正都會留下紀錄。', 'tp-hint'), inputRow('tcp-real', '正確的本名（2～20 個字）', { maxlength: 20 }), inputRow('tcp-reason', '原因（4～30 個字）', { maxlength: 30, placeholder: '例如: 家長通知更正' }),
            el('div', { class: 'atp-act' }, [btn('儲存', 'ds-btn--gold', function () { saveName(s); }, 'tcp-save'), btn('取消', 'ds-btn--ghost', function () { closePanel(); }, 'tcp-no')])]);
    }
    async function saveName(s) {
        const r = await call({ action: 'update_student_real_name', class_id: st.cls.class_id, member_id: s.member_id, real_name: val('tcp-real').trim(), reason: val('tcp-reason').trim() }, 'tcp-msg'); if (!r) return;
        if (r.status !== 'success') { say('tcp-msg', r.message || '無法更正。'); return; }
        await openClass(st.cls.class_id, true); say('tcc-msg', '已更正本名，並留下紀錄。');
    }

    function removePanel(s) {
        openPanel('移除學生', [para('移除後，你就看不到這位學生的個人資料了。學生自己的進度、星星和裝扮都還在，他可以繼續自己冒險。', 'tp-note'), checkRow('tcp-ok', '我確定要把這位學生移出這個班級'),
            el('div', { class: 'atp-act' }, [btn('移除', 'ds-btn--coral', function () { doRemove(s); }, 'tcp-yes'), btn('取消', 'ds-btn--ghost', function () { closePanel(); }, 'tcp-no')])]);
    }
    async function doRemove(s) {
        if (!$('tcp-ok').checked) { say('tcp-msg', '請先勾選確認。'); return; }
        const r = await call({ action: 'remove_class_student', class_id: st.cls.class_id, member_id: s.member_id, confirm: true }, 'tcp-msg'); if (!r) return;
        if (r.status !== 'success') { say('tcp-msg', r.message || '無法移除。'); return; }
        await openClass(st.cls.class_id, true); say('tcc-msg', '已移除。');
    }

    /* ---------- 當面確認（只有管理員確認的教師；啟用碼／臨時 PIN 只顯示一次） ---------- */
    function identityPanel(s, action) {
        const isReset = action === 'reset_student_pin';
        openPanel(isReset ? '重設 PIN（當面確認）' : '當面確認並核發啟用碼', [
            para('請確認眼前的人就是這位學生本人。暱稱和稱號，任何知道登入代碼的人都看得到，不能當作證明；沒有可靠的依據時，請不要核發。', 'tp-note'),
            checkRow('tcp-confirm', '我已實際確認眼前的人就是這個帳號的本人'),
            el('fieldset', { class: 'ast-confirm' }, [el('legend', { text: '確認方式' }),
                radioRow('tcp-method', 'know', '當面認得這位學生', 'tcp-m-know'), radioRow('tcp-method', 'guardian', '由其導師或家長當面確認', 'tcp-m-guardian'), radioRow('tcp-method', 'other', '其他（要寫明可靠的依據）', 'tcp-m-other'),
                el('div', { id: 'tcp-other-wrap', hidden: '' }, [inputRow('tcp-other', '說明（4～30 個字，不能只寫「比對暱稱」）', { maxlength: 30 })])]),
            el('div', { class: 'atp-act' }, [btn(isReset ? '重設並顯示臨時 PIN' : '核發啟用碼', 'ds-btn--gold', function () { doIdentity(s, action); }, 'tcp-go'), btn('取消', 'ds-btn--ghost', function () { closePanel(); }, 'tcp-no')])
        ]);
        document.querySelectorAll('input[name="tcp-method"]').forEach(function (r) { r.addEventListener('change', function () { const m = document.querySelector('input[name="tcp-method"]:checked'); $('tcp-other-wrap').hidden = !(m && m.value === 'other'); }); });
    }
    async function doIdentity(s, action) {
        const m = document.querySelector('input[name="tcp-method"]:checked');
        const payload = { action: action, class_id: st.cls.class_id, member_id: s.member_id, confirmed: !!$('tcp-confirm').checked, method: m ? m.value : '' };
        if (payload.method === 'other') payload.method_other = val('tcp-other').trim();
        const r = await call(payload, 'tcp-msg'); if (!r) return;
        if (r.status !== 'success') { say('tcp-msg', r.message || '無法完成。'); return; }
        const isReset = action === 'reset_student_pin', secret = isReset ? r.temp_pin : r.activation_code;
        openPanel(isReset ? '臨時 PIN（只顯示這一次）' : '啟用碼（只顯示這一次）', [
            el('div', { class: 'atp-temp sp-code-box', role: 'alert' }, [el('code', { id: 'tcp-secret', class: 'sp-code', text: secret })]),
            para((isReset ? '24 小時內有效，學生登入後必須先更改。' : '3 天內有效，輸錯 5 次作廢；學生啟用後就會正式加入你的班級。') + '請當面交給學生，不要貼在群組或公開的地方。今天還能再核發 ' + r.remaining_today + ' 組。', 'tp-note'),
            btn('我已交給學生，關閉', 'ds-btn--gold', function () { closePanel(); openClass(st.cls.class_id, true); }, 'tcp-done')
        ]);
    }
    async function revoke(s) {
        const r = await call({ action: 'revoke_activation_code', class_id: st.cls.class_id, member_id: s.member_id }, 'tcc-msg'); if (!r) return;
        if (r.status !== 'success') { say('tcc-msg', r.message || '無法作廢。'); return; }
        await openClass(st.cls.class_id, true); say('tcc-msg', r.revoked ? '已作廢這組啟用碼。' : '這位學生目前沒有你核發的啟用碼。');
    }

    /* ---------- 匯出 CSV（後端已依可視範圍篩選、並處理公式注入） ---------- */
    function csvCell(v) { const s = String(v === undefined || v === null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    async function doExport() {
        const r = await call({ action: 'export_class_data', class_id: st.cls.class_id }, 'tcc-msg'); if (!r) return;
        if (r.status !== 'success') { say('tcc-msg', r.message || '無法匯出。'); return; }
        const lines = [r.columns.map(csvCell).join(',')].concat(r.rows.map(function (row) { return row.map(csvCell).join(','); }));
        const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = el('a', { href: url, download: (typeof APP_FILE_PREFIX === 'string' ? APP_FILE_PREFIX : 'class') + '_班級名單.csv' });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        say('tcc-msg', r.note || '已匯出。');
    }

    function reset() {
        st.list = null; st.cls = null; st.roster = null; st.tab = 'students'; st.busy = false; st.verified = false; st.l2 = null; st.panel = null;
        ['tcl-name', 'tcl-school', 'tcl-year'].forEach(function (id) { const e = $(id); if (e) e.value = ''; });
        ['tcl-list', 'tcl-xfer', 'tcc-head', 'tcc-tools', 'tcc-tabs', 'tcc-table-wrap', 'tcp-secret'].forEach(function (id) { const e = $(id); if (e) e.textContent = ''; });
        closePanel();
    }

    return { open: openFromHome, openList: openList, openClass: openClass, reset: reset, _state: st };
})();
