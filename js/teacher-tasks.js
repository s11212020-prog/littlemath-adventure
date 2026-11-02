/* 階段 9D-2：教師任務畫面（建立、修改、關閉、進度、修改紀錄、匯出）
   * 全部畫面由這支程式建立；後端傳來的文字一律用 textContent 寫入，不當成 HTML。
   * 不保存任何資料到瀏覽器儲存空間；教師看到的學生範圍完全由後端決定，這裡只顯示後端給的欄位。
   * 統計是 null（無法可靠取得）時一律顯示「無法判定」，絕不顯示成 0；離班結果還在結算時顯示「結算中」，絕不顯示成「未完成」。
   * 所有時間都是臺北時間（後端已轉好）。
   * 完成狀態是學生端回報的紀錄，這裡的說明文字固定顯示，教師不能關掉。 */
const TeacherTasks = (function () {
    const $ = function (id) { return document.getElementById(id); };
    const token = function () { return (AuthSession.teacher && AuthSession.teacher.token) || ''; };
    const ISLAND_LIST = ['加法島', '減法島', '乘法島', '除法島', '應用題島', '四則運算島'];
    const ZONE_OPTS = [['LEARNING', '學習區'], ['PRACTICE', '練習區'], ['MASTERY', '精熟區'], ['ALL', '三個區域都要完成']];
    const POLICY_OPTS = [['accept_existing', '已經完成過的進度也算（完成時間會標示為不明）'], ['require_after_publish', '必須在任務發布之後重新完成才算']];
    const POLICY_ZH = { accept_existing: '既有進度也算', require_after_publish: '必須發布後完成' };
    const ZONE_ZH = { LEARNING: '學習區', PRACTICE: '練習區', MASTERY: '精熟區', ALL: '三個區域都要完成' };
    const FIELD_ZH = { title: '標題', description: '說明', due_date: '截止日' };
    const STATUS_ZH = {
        not_started: '尚未開始', in_progress: '進行中', completed: '已完成', completed_on_time: '準時完成', completed_late: '逾期完成', completed_existing: '既有進度，完成時間不明',
        overdue_incomplete: '已逾期未完成', closed_incomplete: '任務關閉時未完成', left_incomplete: '離班時未完成', undetermined: '無法判定'
    };
    const SOURCE_NOTE = '完成狀態是依學生端送出的紀錄整理的，用來了解練習進度，不是考試成績，也不能當成身分證明。';
    const STATS_NOTE = '作答統計只計「任務發布後、在指定島嶼與區域」的作答，不是學生帳號的累積數字；系統無法可靠取得時顯示「無法判定」，不會顯示成 0。';
    const NA = '無法判定';
    const st = { cls: null, list: null, cur: null, prog: null, busy: false, panel: null };

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
    function inputRow(id, label, opt) {
        opt = opt || {};
        const props = { type: opt.type || 'text', id: id, class: 'ds-input', autocomplete: 'off', spellcheck: 'false' };
        if (opt.maxlength) props.maxlength = String(opt.maxlength);
        if (opt.placeholder) props.placeholder = opt.placeholder;
        const kids = [el('label', { class: 'ds-label', for: id, text: label }), el('input', props)];
        if (opt.hint) kids.push(el('p', { class: 'tp-hint', text: opt.hint }));
        return el('div', { class: 'ds-field' }, kids);
    }
    function selectRow(id, label, opts, hint) {
        const sel = el('select', { id: id, class: 'ds-input ta-select' }, opts.map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
        const kids = [el('label', { class: 'ds-label', for: id, text: label }), sel];
        if (hint) kids.push(el('p', { class: 'tp-hint', text: hint }));
        return el('div', { class: 'ds-field' }, kids);
    }
    function fmt(iso) { return String(iso || '').replace('T', ' ').slice(0, 16); }
    function mkScreen(id, title, body) {
        if ($(id)) return $(id);
        const sea = el('div', { class: 'en-sea', 'aria-hidden': 'true' }, [el('i', { class: 'en-sun' }), el('i', { class: 'en-cloud en-cloud--1' }), el('i', { class: 'en-cloud en-cloud--2' }), el('i', { class: 'en-isle en-isle--1' }), el('i', { class: 'en-waves' })]);
        const card = el('div', { class: 'ds-card ds-card--canvas en-card sp-card tc-card ta-card' }, [el('h1', { class: 'ds-plank en-card__title', id: id + '-title', text: title })].concat(body));
        const s = el('div', { id: id, class: 'screen en-screen sp-screen tc-screen ta-screen' }, [sea, el('div', { class: 'en-wrap en-wrap--card tc-wrap' }, [card])]);
        document.body.appendChild(s);
        return s;
    }
    function open(id) { if (typeof switchScreen === 'function') switchScreen(id); }
    function lost() { if (typeof TeacherPortal !== 'undefined' && TeacherPortal.sessionLost) TeacherPortal.sessionLost(); }
    async function call(payload, msgId) {
        if (typeof GAS_URL !== 'string' || GAS_URL.indexOf('http') !== 0) { say(msgId, '目前是示範模式（沒有連到後端），任務功能需要連線後才能使用。'); return null; }
        if (!AuthSession.teacher) { lost(); return null; }
        if (st.busy || (typeof Loading !== 'undefined' && Loading.busy)) { say(msgId, '上一個動作還在處理中，請稍候再按一次。'); return null; }
        st.busy = true;
        try {
            const r = await apiCall(Object.assign({ token: token() }, payload));
            if (r && r.code === 'SESSION_INVALID') { lost(); return null; }
            return r || { status: 'error', message: '連線失敗，請檢查網路後再試一次' };
        } catch (e) { console.error(e); return { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; }
        finally { st.busy = false; }
    }
    function zoneText(g) { return ZONE_ZH[g.zone] || String(g.zone || ''); }
    function dueText(g) { return g.due_date ? (g.due_date + '（含當天）') : '沒有截止日'; }
    function notesBlock(withStats) {
        const kids = [para(SOURCE_NOTE, 'tp-note ta-note')];
        if (withStats) kids.push(para(STATS_NOTE, 'tp-note ta-note'));
        return el('div', { class: 'ta-notes' }, kids);
    }

    /* ---------- 建立畫面 ---------- */
    function build() {
        if ($('screen-ta-list')) return;
        mkScreen('screen-ta-list', '老師任務', [
            el('div', { id: 'tal-head' }),
            el('div', { id: 'tal-counts', class: 'ta-counts' }),
            el('div', { id: 'tal-create', class: 'tc-form ta-form', hidden: '' }, [
                el('h2', { class: 'tp-hello', text: '發布新任務' }),
                inputRow('tal-title', '任務標題（2～40 個字）', { maxlength: 40, placeholder: '例如：本週加法練習' }),
                inputRow('tal-desc', '任務說明（選填，最多 200 個字，純文字）', { maxlength: 200 }),
                selectRow('tal-island', '指定島嶼', ISLAND_LIST.map(function (n) { return [n, n]; })),
                selectRow('tal-zone', '指定區域', ZONE_OPTS),
                selectRow('tal-policy', '完成判定方式', POLICY_OPTS, '發布後就不能改島嶼、區域和判定方式；要改請關閉任務後另外建立新任務。'),
                inputRow('tal-due', '截止日（選填）', { type: 'date', hint: '截止日當天整天都算準時（臺北時間）。不填就是沒有截止日。' }),
                btn('發布任務', 'ds-btn--gold', function () { doCreate(this); }, 'tal-publish'),
                para('任務不會鎖住學生的任何島嶼；沒有加入班級的學生不受影響。', 'tp-hint')
            ]),
            el('h2', { class: 'tp-hello', text: '任務清單' }),
            el('div', { id: 'tal-list', class: 'ta-cards' }),
            notesBlock(false),
            errLine('tal-msg'),
            btn('回班級', 'ds-btn--ghost en-back', function () { if (typeof TeacherClass !== 'undefined' && st.cls) TeacherClass.openClass(st.cls.class_id, true); }, 'tal-back')
        ]);
        mkScreen('screen-ta-detail', '任務進度', [
            el('div', { id: 'tad-head' }),
            el('div', { id: 'tad-tools', class: 'tc-tools' }),
            el('div', { id: 'tad-panel', class: 'tc-panel ta-panel', hidden: '' }),
            el('div', { id: 'tad-summary', class: 'ta-summary', role: 'status' }),
            el('div', { id: 'tad-notes' }),
            el('h2', { class: 'tp-hello', id: 'tad-h-in', text: '在班學生' }),
            el('div', { id: 'tad-in' }),
            el('h2', { class: 'tp-hello', id: 'tad-h-left', text: '已離班學生（凍結的結果）' }),
            el('div', { id: 'tad-left' }),
            errLine('tad-msg'),
            btn('回任務清單', 'ds-btn--ghost en-back', function () { openList(st.cls); }, 'tad-back')
        ]);
    }

    /* ---------- 任務清單 ---------- */
    async function openList(cls) {
        if (cls) st.cls = cls;
        if (!st.cls) return;
        build(); closePanel(); say('tal-msg', ''); open('screen-ta-list');
        say('screen-ta-list-title', '老師任務');
        const head = $('tal-head'); head.textContent = '';
        head.appendChild(para('班級：' + st.cls.class_name + (st.cls.status === 'archived' ? '（已封存，只能查看，不能發布或修改）' : ''), 'tp-hello'));
        $('tal-create').hidden = st.cls.status !== 'active';
        const r = await call({ action: 'list_assignments', class_id: st.cls.class_id }, 'tal-msg'); if (!r) return;
        if (r.status !== 'success') {
            const off = r.code === 'FEATURE_OFF' || r.code === 'SCHEMA_NOT_READY';
            $('tal-create').hidden = true; $('tal-list').textContent = ''; $('tal-counts').textContent = '';
            say('tal-msg', off ? '任務功能目前還沒有開放。請管理員確認後再使用。' : (r.message || '現在讀不到任務清單，這不代表沒有任務，請稍後再試。')); return;
        }
        st.list = r;
        renderCounts(r);
        renderList(r.assignments || [], r.limits || {});
    }
    function renderCounts(r) {
        const box = $('tal-counts'); box.textContent = '';
        if (r.pending_freeze_count) box.appendChild(para('有 ' + r.pending_freeze_count + ' 位離班學生的任務結果結算中，完成後才會出現在各任務的「已離班」名單；結算中不代表沒有完成。', 'tp-note ta-pending'));
        if (r.not_shared_count) box.appendChild(para('另有 ' + r.not_shared_count + ' 位學生尚未同意分享，看不到他們的任務進度。', 'tp-hint ta-notshared'));
    }
    function renderList(items, limits) {
        const box = $('tal-list'); box.textContent = '';
        if (!items.length) { box.appendChild(para('還沒有任務。發布第一個任務後，會出現在這裡。', 'tp-hint')); return; }
        items.forEach(function (g) {
            const isOpen = g.status === 'open';
            const c = el('article', { class: 'tc-class ta-task' + (isOpen ? '' : ' is-closed'), 'data-status': g.status }, [
                el('h3', { class: 'tp-hello ta-title', text: g.title }),
                el('span', { class: 'ds-chip ' + (isOpen ? 'ds-chip--info' : 'ta-chip--plain'), text: isOpen ? '進行中' : '已關閉' }),
                para(g.island + '　' + zoneText(g), 'tp-hint'),
                para('截止日：' + dueText(g) + '　發布：' + fmt(g.published_at), 'tp-hint'),
                g.closed_at ? para('關閉時間：' + fmt(g.closed_at), 'tp-hint') : null,
                g.edited ? para('已修改 ' + g.edit_count + ' 次（可在任務內查看修改紀錄）', 'tp-hint ta-edited') : null
            ]);
            c.appendChild(btn('查看進度', 'ds-btn--sea', function () { openDetail(g.assignment_id); }, 'tal-view-' + g.assignment_id));
            box.appendChild(c);
        });
        if (limits && limits.max_open) box.appendChild(para('每個班同時進行中的任務最多 ' + limits.max_open + ' 個，每位教師每天最多發布 ' + limits.max_per_day + ' 個。', 'tp-hint'));
    }
    async function doCreate(b) {
        say('tal-msg', '');
        const title = val('tal-title').trim(), desc = val('tal-desc').trim();
        if (title.length < 2) { say('tal-msg', '請輸入任務標題（至少 2 個字）。'); return; }
        const payload = { action: 'create_assignment', class_id: st.cls.class_id, title: title, description: desc, island: val('tal-island'), zone: val('tal-zone'), completion_policy: val('tal-policy') };
        const due = val('tal-due').trim(); if (due) payload.due_date = due;
        b.disabled = true;
        const r = await call(payload, 'tal-msg'); b.disabled = false; if (!r) return;
        if (r.status !== 'success') { say('tal-msg', r.message || '無法發布任務。'); return; }
        ['tal-title', 'tal-desc', 'tal-due'].forEach(function (id) { const e = $(id); if (e) e.value = ''; });
        await openList(st.cls); say('tal-msg', '已發布任務「' + (r.assignment ? r.assignment.title : title) + '」。');
    }

    /* ---------- 任務進度 ---------- */
    function closePanel() { st.panel = null; const p = $('tad-panel'); if (p) { p.hidden = true; p.textContent = ''; } }
    function openPanel(title, kids) {
        const p = $('tad-panel'); p.textContent = ''; p.hidden = false; st.panel = title;
        p.appendChild(el('h2', { class: 'tp-hello', text: title }));
        kids.forEach(function (k) { p.appendChild(k); });
        p.appendChild(errLine('tdp-msg'));
        if (p.scrollIntoView) p.scrollIntoView({ block: 'nearest' });
    }
    async function openDetail(id, keepMsg) {
        build(); closePanel(); if (!keepMsg) say('tad-msg', ''); open('screen-ta-detail');
        st.cur = { assignment_id: id }; st.prog = null;
        ['tad-in', 'tad-left', 'tad-summary', 'tad-notes', 'tad-head', 'tad-tools'].forEach(function (x) { $(x).textContent = ''; });
        $('tad-in').appendChild(para('載入中…', 'tp-hint'));
        const r = await call({ action: 'get_assignment_progress', class_id: st.cls.class_id, assignment_id: id }, 'tad-msg');
        if (!r) { $('tad-in').textContent = ''; return; }
        if (r.status !== 'success') { $('tad-in').textContent = ''; say('tad-msg', r.message || '現在讀不到這個任務的進度，這不代表沒有人完成，請稍後再試。'); return; }
        st.cur = r.assignment; st.prog = r;
        renderDetail(r);
    }
    function renderDetail(r) {
        const g = r.assignment, isOpen = g.status === 'open';
        say('screen-ta-detail-title', '任務進度');
        const head = $('tad-head'); head.textContent = '';
        head.appendChild(el('h2', { class: 'tp-hello ta-title', id: 'tad-title', text: g.title }));
        if (g.description) head.appendChild(para(g.description, 'tp-hint'));
        head.appendChild(para('班級：' + (st.cls ? st.cls.class_name : '') + '　指定：' + g.island + '　' + zoneText(g), 'tp-hint'));
        head.appendChild(para('完成判定：' + (POLICY_ZH[g.completion_policy] || g.completion_policy) + '　截止日：' + dueText(g), 'tp-hint'));
        head.appendChild(para('狀態：' + (isOpen ? '進行中' : '已關閉') + '　發布：' + fmt(g.published_at) + (g.closed_at ? '　關閉：' + fmt(g.closed_at) : '') + '（臺北時間）', 'tp-hint'));
        const tools = $('tad-tools'); tools.textContent = '';
        if (isOpen && st.cls && st.cls.status === 'active') {
            tools.appendChild(vbtn('修改任務', function () { editPanel(g); }, 'tad-edit'));
            tools.appendChild(vbtn('關閉任務', function () { closeAsgPanel(g); }, 'tad-close'));
        }
        tools.appendChild(vbtn('修改紀錄' + (g.edit_count ? '（' + g.edit_count + '）' : ''), function () { historyPanel(g); }, 'tad-history'));
        tools.appendChild(vbtn('匯出（CSV）', function () { doExport(g); }, 'tad-export'));
        tools.appendChild(vbtn('重新整理', function () { openDetail(g.assignment_id); }, 'tad-refresh'));
        /* 摘要：各狀態人數 */
        const sum = $('tad-summary'); sum.textContent = '';
        const counts = r.summary || {};
        const keys = Object.keys(counts);
        if (!keys.length) sum.appendChild(para('目前沒有可查看的學生。', 'tp-hint'));
        else keys.forEach(function (k) { sum.appendChild(el('span', { class: 'ds-chip ta-sum ta-sum--' + k, 'data-status': k, text: (STATUS_ZH[k] || k) + '　' + counts[k] })); });
        /* 說明（固定顯示） */
        const notes = $('tad-notes'); notes.textContent = '';
        notes.appendChild(notesBlock(true));
        if (r.pending_freeze_count) notes.appendChild(para('結算中：有 ' + r.pending_freeze_count + ' 位離班學生的任務結果還在結算，完成後才會出現在下方「已離班」名單。結算中不代表沒有完成，請稍後按「重新整理」。', 'tp-note ta-pending'));
        if (r.not_shared_count) notes.appendChild(para('另有 ' + r.not_shared_count + ' 位學生尚未同意分享，看不到他們的任務進度。', 'tp-hint ta-notshared'));
        if (r.evidence && (r.evidence.events_complete === false || r.evidence.logs_complete === false)) notes.appendChild(para('這個任務累積的紀錄太多，部分統計無法可靠取得，會顯示「無法判定」。', 'tp-hint ta-evidence'));
        /* 表格 */
        renderTable($('tad-in'), r.students || [], false, '目前沒有在班且已同意分享的學生資料可顯示。');
        renderTable($('tad-left'), r.left || [], true, r.pending_freeze_count ? '已離班學生的結果結算中，完成後會出現在這裡。' : '沒有已離班學生的結果。');
        if ((r.left || []).length || r.left_note) $('tad-left').insertBefore(para(r.left_note || '', 'tp-hint'), $('tad-left').firstChild);
    }
    function numCell(row, k) { return (row.stats_state === 'ok' && row[k] !== null && row[k] !== undefined) ? String(row[k]) : NA; }
    function starCell(row) { return (row.best_stars === null || row.best_stars === undefined) ? (row.status === 'undetermined' ? NA : '—') : String(row.best_stars); }
    function doneCell(row) {
        if (row.time_unknown) return '完成時間不明';
        return row.completed_at ? fmt(row.completed_at) : '—';
    }
    function lastCell(row) { return row.stats_state === 'ok' ? (fmt(row.last_answer_at) || '—') : NA; }
    function renderTable(host, rows, left, emptyText) {
        host.textContent = '';
        if (!rows.length) { host.appendChild(para(emptyText, 'tp-hint')); return; }
        const cols = left ? ['暱稱', '狀態', '完成方式', '完成時間', '最佳星數', '發布後答對', '發布後答錯', '提示次數', '最近作答']
            : ['暱稱', '本名', '帳號識別', '狀態', '完成方式', '完成時間', '最佳星數', '發布後答對', '發布後答錯', '提示次數', '最近作答'];
        const t = el('table', { class: 'admin-table compact ta-table', 'data-kind': left ? 'left' : 'in' });
        const hr = el('tr'); cols.forEach(function (c) { hr.appendChild(el('th', { scope: 'col', text: c })); });
        t.appendChild(el('thead', null, [hr]));
        const tb = el('tbody');
        rows.forEach(function (s) {
            const tr = el('tr', { 'data-status': s.status });
            const cells = [s.nickname || ''];
            if (!left) { cells.push(s.real_name ? s.real_name : (s.real_name_missing ? '（尚未填寫）' : '')); cells.push(s.id_last4 || ''); }
            cells.push(s.status === 'undetermined' ? NA : (s.status_label || STATUS_ZH[s.status] || ''));
            cells.push(s.basis_label || '—', doneCell(s), starCell(s), numCell(s, 'correct_count'), numCell(s, 'wrong_count'), numCell(s, 'hint_count'), lastCell(s));
            cells.forEach(function (x, i) {
                const td = el('td', { text: x });
                if (x === NA) td.className = 'ta-na';
                tr.appendChild(td);
            });
            tb.appendChild(tr);
        });
        t.appendChild(tb);
        host.appendChild(el('div', { class: 'td-scroll', tabindex: '0', role: 'region', 'aria-label': left ? '已離班學生的任務結果' : '在班學生的任務結果' }, [t]));
    }

    /* ---------- 修改任務 ---------- */
    function editPanel(g) {
        const t = inputRow('tdp-title', '任務標題（2～40 個字）', { maxlength: 40 }), d = inputRow('tdp-desc', '任務說明（選填，最多 200 個字）', { maxlength: 200 }), u = inputRow('tdp-due', '截止日（清空就是沒有截止日）', { type: 'date' });
        openPanel('修改任務', [
            para('發布後只能修改標題、說明和截止日；島嶼、區域和完成判定方式不能改。每次修改都會留下紀錄。', 'tp-hint'),
            t, d, u,
            el('div', { class: 'atp-act' }, [btn('儲存', 'ds-btn--gold', function () { saveEdit(g, this); }, 'tdp-save'), btn('取消', 'ds-btn--ghost', function () { closePanel(); }, 'tdp-no')])
        ]);
        $('tdp-title').value = g.title || ''; $('tdp-desc').value = g.description || ''; $('tdp-due').value = g.due_date || '';
    }
    async function saveEdit(g, b) {
        say('tdp-msg', '');
        const payload = { action: 'update_assignment', class_id: st.cls.class_id, assignment_id: g.assignment_id };
        const title = val('tdp-title').trim(), desc = val('tdp-desc').trim(), due = val('tdp-due').trim();
        if (title !== (g.title || '')) { if (title.length < 2) { say('tdp-msg', '任務標題至少 2 個字。'); return; } payload.title = title; }
        if (desc !== (g.description || '')) payload.description = desc;
        if (due !== (g.due_date || '')) payload.due_date = due;
        if (Object.keys(payload).length === 3) { say('tdp-msg', '沒有要修改的內容。'); return; }
        b.disabled = true;
        const r = await call(payload, 'tdp-msg'); b.disabled = false; if (!r) return;
        if (r.status !== 'success') { say('tdp-msg', r.message || '無法修改。'); return; }
        await openDetail(g.assignment_id); say('tad-msg', r.note || '已修改，並留下修改紀錄。');
    }
    async function historyPanel(g) {
        openPanel('修改紀錄', [para('載入中…', 'tp-hint')]);
        const r = await call({ action: 'list_assignment_edits', class_id: st.cls.class_id, assignment_id: g.assignment_id }, 'tdp-msg'); if (!r) return;
        if (r.status !== 'success') { openPanel('修改紀錄', [para(r.message || '現在讀不到修改紀錄，請稍後再試。', 'tp-hint')]); return; }
        const kids = [para('任務發布時間：' + fmt(r.published_at) + '（臺北時間）', 'tp-hint')];
        if (!(r.edits || []).length) kids.push(para('這個任務沒有被修改過。', 'tp-hint'));
        else {
            const t = el('table', { class: 'admin-table compact ta-table' });
            const hr = el('tr'); ['修改時間', '欄位', '修改前', '修改後'].forEach(function (c) { hr.appendChild(el('th', { scope: 'col', text: c })); });
            t.appendChild(el('thead', null, [hr]));
            const tb = el('tbody');
            r.edits.forEach(function (e) {
                const tr = el('tr');
                [fmt(e.edited_at), FIELD_ZH[e.field] || e.field, e.old_value === '' ? '（空）' : e.old_value, e.new_value === '' ? '（空）' : e.new_value].forEach(function (x) { tr.appendChild(el('td', { text: x })); });
                tb.appendChild(tr);
            });
            t.appendChild(tb);
            kids.push(el('div', { class: 'td-scroll', tabindex: '0', role: 'region', 'aria-label': '修改紀錄' }, [t]));
        }
        kids.push(btn('關閉', 'ds-btn--ghost', function () { closePanel(); }, 'tdp-no'));
        openPanel('修改紀錄', kids);
    }

    /* ---------- 關閉任務 ---------- */
    function closeAsgPanel(g) {
        openPanel('關閉任務', [
            para('關閉後不能重新開啟，也不能再修改。關閉之後才完成的紀錄不會再計入這個任務，學生會看到「已關閉」。', 'tp-note'),
            checkRow('tdp-close-ok', '我確定要關閉這個任務'),
            el('div', { class: 'atp-act' }, [btn('確定關閉', 'ds-btn--coral', function () { doClose(g, this); }, 'tdp-yes'), btn('取消', 'ds-btn--ghost', function () { closePanel(); }, 'tdp-no')])
        ]);
    }
    async function doClose(g, b) {
        say('tdp-msg', '');
        const ok = $('tdp-close-ok'); if (!ok || !ok.checked) { say('tdp-msg', '請先勾選確認。'); return; }
        b.disabled = true;
        const r = await call({ action: 'close_assignment', class_id: st.cls.class_id, assignment_id: g.assignment_id, confirm: true }, 'tdp-msg'); b.disabled = false; if (!r) return;
        if (r.status !== 'success') { say('tdp-msg', r.message || '無法關閉。'); return; }
        await openDetail(g.assignment_id); say('tad-msg', r.note || '任務已關閉。');
    }

    /* ---------- 匯出 CSV（後端已依可視範圍篩選、並處理公式注入） ---------- */
    function csvCell(v) { const s = String(v === undefined || v === null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    function fileSafe(s) { return String(s || '').replace(/[\\\/:*?"<>|\s]+/g, '_').slice(0, 20) || '任務'; }
    async function doExport(g) {
        const r = await call({ action: 'export_assignment', class_id: st.cls.class_id, assignment_id: g.assignment_id }, 'tad-msg'); if (!r) return;
        if (r.status !== 'success') { say('tad-msg', r.message || '無法匯出。'); return; }
        const lines = [r.columns.map(csvCell).join(',')].concat(r.rows.map(function (row) { return row.map(csvCell).join(','); }));
        const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: (typeof APP_FILE_PREFIX === 'string' ? APP_FILE_PREFIX : 'task') + '_任務進度_' + fileSafe(g.title) + '.csv' });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        say('tad-msg', (r.note || '已匯出。') + '　' + SOURCE_NOTE);
    }

    function reset() {
        st.cls = null; st.list = null; st.cur = null; st.prog = null; st.busy = false; st.panel = null;
        ['tal-title', 'tal-desc', 'tal-due'].forEach(function (id) { const e = $(id); if (e) e.value = ''; });
        ['tal-head', 'tal-counts', 'tal-list', 'tad-head', 'tad-tools', 'tad-panel', 'tad-summary', 'tad-notes', 'tad-in', 'tad-left', 'tal-msg', 'tad-msg'].forEach(function (id) { const e = $(id); if (e) e.textContent = ''; });
    }

    return { open: openList, openDetail: openDetail, reset: reset, _state: st, _const: { SOURCE_NOTE: SOURCE_NOTE, STATS_NOTE: STATS_NOTE } };
})();
