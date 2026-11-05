/* 階段 10：管理員中心（新版後台入口）
   * 登入後只顯示功能卡片，不預先下載任何學習紀錄；點進哪一區才讀哪一區的資料。
   * 所有清單都是後端真正分頁（每頁 20 筆），畫面用卡片呈現，窄螢幕不需要橫向捲動。
   * 舊版儀表板收在「資料匯出中心 → 學習紀錄分析（進階）」，按下去才載入。
   * 文字一律用 textContent 寫入；不顯示密碼、雜湊、Token。 */
const AdminCenter = (function () {
    const $ = function (id) { return document.getElementById(id); };
    const TIMEOUT_MS = 20000;
    let trail = [];          /* 麵包屑：[{label, run}] */
    let seq = 0;             /* 避免舊請求蓋掉新畫面 */
    let exporting = false;

    /* ---------- 小工具 ---------- */
    function toTop() { try { if (typeof window.scrollTo === 'function') window.scrollTo(0, 0); } catch (e) { /* 舊瀏覽器沒有 scrollTo 也沒關係 */ } }
    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = String(text); return e; }
    function btn(text, fn, cls, id) { const b = el('button', cls || 'btn-view', text); b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fn); return b; }
    function when(t) { return t ? String(t).replace('T', ' ').slice(0, 16) : '—'; }
    function token() { return (AuthSession.admin && AuthSession.admin.token) || ''; }
    function main() { return $('ac-main'); }
    function clear(n) { n.textContent = ''; }
    function lifeRing() {
        const src = document.querySelector('#loading .lf'); const w = el('div', 'ac-loading'); w.setAttribute('role', 'status');
        if (src) { const c = src.cloneNode(true); c.classList.add('ac-lf'); w.appendChild(c); }
        w.appendChild(el('p', 'ac-loading__t', '讀取中…')); return w;
    }
    function stateBox(kind, text, retry) {
        const b = el('div', 'ac-state ac-state--' + kind); b.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        b.appendChild(el('p', 'ac-state__t', text)); if (retry) b.appendChild(btn('重新讀取', retry, 'ds-btn ds-btn--gold ds-btn--sm')); return b;
    }
    function withTimeout(p) {
        return new Promise(function (resolve) {
            const t = setTimeout(function () { resolve({ status: 'error', code: 'TIMEOUT', message: '連線逾時，請檢查網路後再試一次' }); }, TIMEOUT_MS);
            p.then(function (r) { clearTimeout(t); resolve(r); }, function (e) { clearTimeout(t); console.error(e); resolve({ status: 'error', code: 'NETWORK', message: '連線失敗，請檢查網路後再試一次' }); });
        });
    }
    async function call(payload) {
        const r = await withTimeout(apiCall(Object.assign({ token: token() }, payload)));
        if (r && r.code === 'SESSION_INVALID') { if (typeof adminSessionExpired === 'function') adminSessionExpired(); return null; }
        return r || { status: 'error', message: '沒有收到回應' };
    }
    function errText(r) {
        if (!r) return '';
        if (r.code === 'FEATURE_OFF') return '這項功能目前沒有開啟。';
        if (r.code === 'SCHEMA_NOT_READY') return '資料表尚未建立完成，請先完成系統設定。';
        if (r.code === 'FORBIDDEN' || r.code === 'NO_PERMISSION') return '沒有權限執行這個動作。';
        return r.message || '發生問題，請稍後再試。';
    }

    /* ---------- 畫面骨架 ---------- */
    function hidePanels() {
        if (typeof AdminTeachers !== 'undefined') AdminTeachers.leave();
        if (typeof AdminStudents !== 'undefined') AdminStudents.leave();
    }
    function renderCrumbs() {
        const nav = $('ac-crumbs'); clear(nav);
        trail.forEach(function (c, i) {
            if (i) nav.appendChild(el('span', 'ac-crumbs__sep', '›'));
            if (i === trail.length - 1) { const s = el('span', 'ac-crumbs__cur', c.label); s.setAttribute('aria-current', 'page'); nav.appendChild(s); }
            else nav.appendChild(btn(c.label, function () { trail = trail.slice(0, i + 1); run(); }, 'ac-crumb'));
        });
        $('ac-back').hidden = trail.length < 2;
    }
    function run() {
        seq++; hidePanels(); renderCrumbs(); clear(main());
        const cur = trail[trail.length - 1]; try { cur.run(seq); } catch (e) { console.error(e); main().appendChild(stateBox('error', '畫面載入失敗，請回到首頁再試一次。')); }
        toTop();
    }
    function push(label, fn) { trail.push({ label: label, run: fn }); run(); }
    function replaceTop(label, fn) { trail[trail.length - 1] = { label: label, run: fn }; run(); }
    function home() { trail = [{ label: '管理員中心', run: viewHome }]; run(); }
    function back() { if (trail.length > 1) { trail.pop(); run(); } }
    function stale(s) { return s !== seq; }

    /* ---------- 共用：搜尋列、分頁器、清單 ---------- */
    function pager(host, st, total_pages, total, goto) {
        clear(host); host.className = 'ac-pager'; host.setAttribute('role', 'navigation'); host.setAttribute('aria-label', '分頁');
        const info = el('p', 'ac-pager__info', '第 ' + st.page + '／' + total_pages + ' 頁　共 ' + total + ' 筆'); info.id = 'ac-pager-info'; host.appendChild(info);
        const row = el('div', 'ac-pager__row');
        const prev = btn('上一頁', function () { goto(st.page - 1); }, 'btn-view ac-pg', 'ac-prev'); prev.disabled = st.page <= 1; row.appendChild(prev);
        const lo = Math.max(1, Math.min(st.page - 2, total_pages - 4)), hi = Math.min(total_pages, lo + 4);
        for (let i = lo; i <= hi; i++) {
            const b = btn(String(i), function () { goto(i); }, 'btn-view ac-pg' + (i === st.page ? ' ac-pg--cur' : ''), 'ac-page-' + i);
            if (i === st.page) b.setAttribute('aria-current', 'page'); b.setAttribute('aria-label', '第 ' + i + ' 頁'); row.appendChild(b);
        }
        const next = btn('下一頁', function () { goto(st.page + 1); }, 'btn-view ac-pg', 'ac-next'); next.disabled = st.page >= total_pages; row.appendChild(next);
        host.appendChild(row);
    }
    /* 通用清單頁：opts = {fetch(st)->Promise, key:'students', sorts:[[v,label]], item(obj)->Node, empty, placeholder, exportBtn, searchRequired} */
    function listPage(root, opts) {
        const st = Object.assign({ page: 1, search: '', sort: opts.sorts[0][0], order: opts.order || 'desc' }, opts.state || {});
        const bar = el('form', 'ac-bar'); bar.setAttribute('role', 'search'); bar.addEventListener('submit', function (e) { e.preventDefault(); st.search = q.value.trim(); st.page = 1; load(); });
        const ql = el('label', 'ac-bar__q'); ql.appendChild(el('span', null, opts.searchLabel || '搜尋'));
        const q = el('input'); q.type = 'search'; q.id = 'ac-search'; q.maxLength = 40; q.placeholder = opts.placeholder || ''; q.autocomplete = 'off'; q.value = st.search; ql.appendChild(q); bar.appendChild(ql);
        const sl = el('label', 'ac-bar__s'); sl.appendChild(el('span', null, '排序')); const sel = el('select'); sel.id = 'ac-sort';
        opts.sorts.forEach(function (s) { const o = el('option', null, s[1]); o.value = s[0]; sel.appendChild(o); }); sel.value = st.sort;
        sel.addEventListener('change', function () { st.sort = sel.value; st.page = 1; load(); }); sl.appendChild(sel); bar.appendChild(sl);
        const ol = el('label', 'ac-bar__o'); ol.appendChild(el('span', null, '順序')); const so = el('select'); so.id = 'ac-order';
        [['desc', '由大到小／新到舊'], ['asc', '由小到大／舊到新']].forEach(function (s) { const o = el('option', null, s[1]); o.value = s[0]; so.appendChild(o); }); so.value = st.order;
        so.addEventListener('change', function () { st.order = so.value; st.page = 1; load(); }); ol.appendChild(so); bar.appendChild(ol);
        const go = el('button', 'ds-btn ds-btn--deep ds-btn--sm', '搜尋'); go.type = 'submit'; go.id = 'ac-go'; bar.appendChild(go);
        const clr = btn('清除搜尋', function () { q.value = ''; st.search = ''; st.page = 1; load(); }, 'btn-view td-clear', 'ac-clear'); bar.appendChild(clr);
        root.appendChild(bar);
        if (opts.exportBtn) { const ex = el('div', 'ac-actions'); ex.appendChild(opts.exportBtn(st)); root.appendChild(ex); }
        const list = el('div', 'ac-list'); list.id = 'ac-list'; const pg = el('div'); pg.id = 'ac-pager';
        root.appendChild(list); root.appendChild(pg);
        let mine = 0;
        async function load() {
            const my = ++mine, sq = seq; clear(list); clear(pg); list.appendChild(lifeRing());
            if (opts.searchRequired && !st.search) { clear(list); list.appendChild(stateBox('empty', opts.searchHint || '請先輸入要搜尋的內容。')); return; }
            const r = await opts.fetch(st); if (my !== mine || stale(sq) || !r) return; clear(list);
            if (r.status !== 'success') { list.appendChild(stateBox('error', errText(r), load)); return; }
            const items = r[opts.key] || [];
            if (opts.onData) opts.onData(r);
            if (!items.length) { list.appendChild(stateBox('empty', st.search ? '找不到符合「' + st.search + '」的資料。' : (opts.empty || '目前沒有資料。'))); return; }
            const note = el('p', 'ac-count', '共 ' + r.total + ' 筆' + (st.search ? '（關鍵字：' + st.search + '）' : '')); note.id = 'ac-count'; list.appendChild(note);
            items.forEach(function (it) { list.appendChild(opts.item(it)); });
            pager(pg, { page: r.page }, r.total_pages, r.total, function (n) { st.page = Math.max(1, Math.min(r.total_pages, n)); load(); toTop(); });
        }
        load(); return { reload: load, state: st };
    }
    function infoCard(title, lines, actions, cls) {
        const c = el('article', 'ac-item' + (cls ? ' ' + cls : '')); c.appendChild(el('h3', 'ac-item__h', title));
        lines.forEach(function (l) { if (l) { const p = el('p', 'ac-item__l'); if (Array.isArray(l)) { p.appendChild(el('span', 'ac-k', l[0])); p.appendChild(document.createTextNode(l[1])); } else p.textContent = l; c.appendChild(p); } });
        if (actions && actions.length) { const a = el('div', 'ac-item__act'); actions.forEach(function (x) { a.appendChild(x); }); c.appendChild(a); }
        return c;
    }
    const STATE = { independent: '一般學生', in_class: '在班', pending: '待確認加入班級' };

    /* ---------- CSV 匯出（含分批） ---------- */
    async function doExport(label, payload, fileBase, statusEl) {
        if (exporting) { if (statusEl) statusEl.textContent = '上一個匯出還在進行中，請稍候。'; return; }
        exporting = true; if (statusEl) statusEl.textContent = '匯出中…';
        try {
            const res = await CsvExport.fetchAll(async function (off) {
                const r = await call(Object.assign({}, payload, { offset: off, limit: 200 })); return r;
            }, function (n, total) { if (statusEl) statusEl.textContent = '匯出中…已取得 ' + n + (total ? '／' + total : '') + ' 筆'; });
            if (!res) { if (statusEl) statusEl.textContent = ''; return; }
            if (res.status !== 'success') { if (statusEl) statusEl.textContent = '匯出失敗：' + errText(res); return; }
            CsvExport.download(CsvExport.fname(fileBase), CsvExport.build(res.meta, res.columns, res.rows));
            if (statusEl) statusEl.textContent = '已匯出「' + label + '」，共 ' + res.rows.length + ' 筆。檔案內含學生資料，請妥善保管。';
        } finally { exporting = false; }
    }
    function exportButton(text, label, payloadFn, base, id) {
        const wrap = el('span', 'ac-exwrap'); const msg = el('span', 'ac-exmsg'); msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
        const b = btn(text, function () { doExport(label, payloadFn(), base, msg); }, 'btn-view ac-export', id); wrap.appendChild(b); wrap.appendChild(msg); return wrap;
    }

    /* ---------- 首頁 ---------- */
    function viewHome() {
        const m = main();
        const intro = el('p', 'ac-intro', '請選擇要處理的項目。每一區只有在點進去之後才會讀取資料。'); m.appendChild(intro);
        const grid = el('div', 'ac-cards'); grid.id = 'ac-home';
        const cards = [
            ['overview', 'chart', '系統總覽', '學生、教師、班級與登入的摘要數字', function () { push('系統總覽', viewOverview); }],
            ['students', 'crew', '一般學生', '尚未加入班級的學生：搜尋、排序、查看詳細', function () { push('一般學生', viewStudents); }],
            ['teachers', 'teacher', '教師與班級', '教師 → 班級 → 班級學生，也可全站搜尋學生', function () { push('教師與班級', viewTeachers); }],
            ['accounts', 'lock', '教師帳號管理', '建立、停用／恢復、重設密碼、管理員確認', function () { push('教師帳號管理', viewTeacherAccounts); }],
            ['help', 'hint', '學生帳號與密碼協助', '查詢帳號狀態、確認身分後重設密碼、稽核', function () { push('學生帳號與密碼協助', viewStudentHelp); }],
            ['export', 'download', '資料匯出中心', 'CSV 匯出與學習紀錄分析（進階）', function () { push('資料匯出中心', viewExport); }],
            ['system', 'gear', '稽核與系統狀態', '版本、資料表、功能開關、稽核紀錄', function () { push('稽核與系統狀態', viewSystem); }],
            ['logout', 'logout', '登出', '結束管理員登入並回到身分選擇', function () { logoutToRoleSelect(); }]
        ];
        cards.forEach(function (c) {
            const b = el('button', 'ac-card ac-card--' + c[0]); b.type = 'button'; b.id = 'ac-card-' + c[0]; b.addEventListener('click', c[4]);
            const ic = el('span', 'ac-card__ic'); ic.setAttribute('data-icon', c[1]); ic.setAttribute('data-size', '40'); b.appendChild(ic);
            const tx = el('span', 'ac-card__tx'); tx.appendChild(el('strong', null, c[2])); tx.appendChild(el('span', null, c[3])); b.appendChild(tx);
            grid.appendChild(b);
        });
        m.appendChild(grid); if (typeof UIKit !== 'undefined' && UIKit.hydrate) UIKit.hydrate(grid);
    }

    /* ---------- 系統總覽 ---------- */
    async function viewOverview(s) {
        const m = main(); m.appendChild(lifeRing());
        const r = await call({ action: 'admin_overview' }); if (!r || stale(s)) return; clear(m);
        if (r.status !== 'success') { m.appendChild(stateBox('error', errText(r), function () { run(); })); return; }
        const o = r.overview;
        const acts = el('div', 'ac-actions'); acts.appendChild(btn('重新整理', function () { run(); }, 'btn-view', 'ac-refresh')); m.appendChild(acts);
        const grid = el('div', 'ac-metrics'); grid.id = 'ac-metrics';
        const M = [
            ['學生總數', o.students_total, null],
            ['一般學生（未加入班級）', o.students_independent, function () { push('一般學生', viewStudents); }],
            ['已加入班級的學生', o.students_joined, function () { push('教師與班級', viewTeachers); }],
            ['教師（使用中／全部）', o.teachers_active + '／' + o.teachers_total, function () { push('教師帳號管理', viewTeacherAccounts); }],
            ['尚未經管理員確認的教師', o.teachers_unverified, function () { push('教師帳號管理', viewTeacherAccounts); }],
            ['使用中的班級', o.classes_active, function () { push('教師與班級', viewTeachers); }],
            ['島嶼任務數', o.tasks_total, null],
            ['已指派的老師測驗', o.quizzes_assigned, null],
            ['24 小時內登入', o.logins_24h, null],
            ['7 天內登入', o.logins_7d, null]
        ];
        M.forEach(function (x) {
            const c = x[2] ? el('button', 'ac-metric ac-metric--link') : el('div', 'ac-metric'); if (x[2]) { c.type = 'button'; c.addEventListener('click', x[2]); }
            c.appendChild(el('span', 'ac-metric__n', x[1])); c.appendChild(el('span', 'ac-metric__l', x[0])); grid.appendChild(c);
        });
        m.appendChild(grid);
        const al = el('section', 'ac-sec'); al.appendChild(el('h2', 'ac-sec__h', '需要留意')); al.id = 'ac-alerts';
        if (!o.alerts.length) al.appendChild(el('p', 'ac-muted', '目前沒有需要處理的項目。'));
        o.alerts.forEach(function (a) {
            const go = a.target === 'accounts' ? viewTeacherAccounts : (a.target === 'status' ? viewSystem : viewTeacherAccounts);
            const lab = a.target === 'status' ? '稽核與系統狀態' : '教師帳號管理';
            const row = el('div', 'ac-alert'); row.appendChild(el('span', null, a.text)); row.appendChild(btn('前往處理', function () { push(lab, go); }, 'btn-view')); al.appendChild(row);
        });
        m.appendChild(al);
        const fl = el('section', 'ac-sec'); fl.appendChild(el('h2', 'ac-sec__h', '功能開關狀態'));
        const FL = { FLAG_CLASSES: '班級功能', FLAG_ASSIGNMENTS: '老師任務', FLAG_REWARDS: '獎勵', FLAG_QUIZ: '老師測驗', FLAG_TEACHER_REGISTRATION: '教師自行註冊', FLAG_STUDENT_PAUSED: '學生端暫停服務' };
        const ul = el('ul', 'ac-flags'); Object.keys(FL).forEach(function (k) { const li = el('li', null, FL[k] + '：' + (o.flags[k] === 'on' ? '開啟' : '關閉')); ul.appendChild(li); }); fl.appendChild(ul); m.appendChild(fl);
    }

    /* ---------- 一般學生 ---------- */
    function studentItem(it, withClass) {
        const lines = [[ '帳號：', it.account_masked ], [ '稱號：', (it.title || '—') + '　星星：' + it.stars + '／54' ], [ '最近登入：', when(it.last_login_at) ], [ '狀態：', STATE[it.state] || it.state ]];
        if (withClass && it.class_name) lines.push([ '班級：', it.class_name + (it.teacher_name ? '（' + it.teacher_name + '）' : '') ]);
        return infoCard(it.nickname || '（未命名）', lines, [btn('查看詳細', function () { push(it.nickname || '學生', function (s) { viewStudentDetail(s, it.student_id); }); }, 'btn-view ac-open')], 'ac-item--student');
    }
    function viewStudents() {
        const m = main(); const h = el('h2', 'ac-h', '一般學生'); m.appendChild(h);
        m.appendChild(el('p', 'ac-muted', '這裡是目前沒有加入任何班級的學生。可用「顯示名稱」或「帳號」搜尋。'));
        listPage(m, { key: 'students', searchLabel: '搜尋學生', placeholder: '顯示名稱或帳號', empty: '目前沒有未加入班級的學生。',
            sorts: [['last_login', '最近登入'], ['created', '建立時間'], ['stars', '星星數'], ['name', '顯示名稱']],
            fetch: function (st) { return call({ action: 'admin_list_students', page: st.page, search: st.search, sort: st.sort, order: st.order }); },
            item: function (it) { return studentItem(it, false); },
            exportBtn: function (st) { return exportButton('匯出目前搜尋結果（全部頁面）', '一般學生搜尋結果', function () { return { action: 'admin_export', kind: 'students_search', scope: 'independent', search: st.search, sort: st.sort, order: st.order }; }, 'students', 'ac-export-students'); } });
    }

    async function viewStudentDetail(s, sid) {
        const m = main(); m.appendChild(lifeRing());
        const r = await call({ action: 'admin_student_detail', student_id: sid }); if (!r || stale(s)) return; clear(m);
        if (r.status !== 'success') { m.appendChild(stateBox('error', errText(r), function () { run(); })); return; }
        const d = r.student; m.id = 'ac-main';
        const head = el('section', 'ac-sec ac-detail'); head.id = 'ac-detail'; head.appendChild(el('h2', 'ac-h', d.nickname));
        head.appendChild(el('p', 'ac-item__l', '帳號：' + d.account_masked + '　稱號：' + d.title + '　星星：' + d.stars + '／54'));
        head.appendChild(el('p', 'ac-item__l', '最近登入：' + when(d.last_login_at) + '　建立時間：' + when(d.created_at)));
        if (d.real_name !== undefined) head.appendChild(el('p', 'ac-item__l', '已登記姓名：' + (d.real_name || '（未登記）')));
        head.appendChild(el('p', 'ac-item__l', '班級狀態：' + (d.class_state === 'in_class' ? '在班' : '一般學生（未加入班級）')));
        const act = el('div', 'ac-actions');
        act.appendChild(exportButton('匯出此學生完整紀錄', d.nickname + ' 完整紀錄', function () { return { action: 'admin_export', kind: 'student_full', student_id: sid }; }, 'student-full', 'ac-export-student'));
        act.appendChild(btn('密碼協助', function () { push('學生帳號與密碼協助', function (s2) { viewStudentHelp(s2, sid, d.nickname); }); }, 'btn-view', 'ac-help-this'));
        head.appendChild(act); m.appendChild(head);
        const isl = el('section', 'ac-sec'); isl.appendChild(el('h3', 'ac-sec__h', '六座島嶼')); const ig = el('div', 'ac-islands');
        d.islands.forEach(function (i) { const c = el('div', 'ac-isl'); c.appendChild(el('strong', null, i.island)); c.appendChild(el('span', null, '星星 ' + i.stars + '／' + i.max)); c.appendChild(el('span', null, '燈塔 ' + i.lighthouse + '／' + i.lighthouse_max)); const bar = el('span', 'ac-bar-fill'); const fill = el('i'); fill.style.width = i.completion + '%'; bar.appendChild(fill); c.appendChild(bar); c.appendChild(el('span', null, '完成度 ' + i.completion + '%')); ig.appendChild(c); });
        isl.appendChild(ig); m.appendChild(isl);
        const cl = el('section', 'ac-sec'); cl.appendChild(el('h3', 'ac-sec__h', '班級紀錄'));
        if (!d.classes.length) cl.appendChild(el('p', 'ac-muted', '沒有班級紀錄。'));
        d.classes.forEach(function (c) { cl.appendChild(el('p', 'ac-item__l', c.class_name + '（' + (c.teacher_name || '—') + '）：' + (c.status === 'active' ? '在班' : '已離班') + '　加入 ' + when(c.joined_at) + (c.left_at ? '　離班 ' + when(c.left_at) : ''))); });
        m.appendChild(cl);
        const lg = el('section', 'ac-sec'); lg.appendChild(el('h3', 'ac-sec__h', '學習紀錄概況'));
        lg.appendChild(el('p', 'ac-item__l', '作答總筆數：' + d.logs.total + '；最近 ' + d.logs.sample + ' 筆中答對 ' + d.logs.correct + ' 筆。'));
        const wr = Object.keys(d.logs.wrong_by_island || {}); if (wr.length) lg.appendChild(el('p', 'ac-item__l', '錯題分布（最近樣本）：' + wr.map(function (k) { return k + ' ' + d.logs.wrong_by_island[k] + ' 題'; }).join('、')));
        d.logs.recent.forEach(function (x) { lg.appendChild(el('p', 'ac-item__l ac-log', when(x.answered_at) + '　' + x.island + ' ' + x.stage + '　' + (x.correct ? '答對' : '答錯') + '　' + x.question + ' → ' + x.student_answer)); });
        m.appendChild(lg);
        if (d.rewards) { const rw = el('section', 'ac-sec'); rw.appendChild(el('h3', 'ac-sec__h', '獎勵摘要')); rw.appendChild(el('p', 'ac-item__l', '領取 ' + d.rewards.claims + ' 項、持有 ' + d.rewards.inventory + ' 件、兌換券 ' + d.rewards.vouchers + ' 張。')); m.appendChild(rw); }
        const pw = el('section', 'ac-sec'); pw.appendChild(el('h3', 'ac-sec__h', '密碼狀態'));
        const PS = { none: '尚未設定密碼', set: '已設定密碼', active: '已設定密碼', must_change: '使用臨時密碼，需要更改', unknown: '狀態需要確認' };
        pw.appendChild(el('p', 'ac-item__l', (PS[d.password_help.status] || d.password_help.status) + '。（畫面不會顯示任何密碼）')); m.appendChild(pw);
    }

    /* ---------- 教師與班級 ---------- */
    function viewTeachers() {
        const m = main(); m.appendChild(el('h2', 'ac-h', '教師與班級'));
        const gs = el('section', 'ac-sec ac-global'); gs.appendChild(el('h3', 'ac-sec__h', '全站學生搜尋'));
        gs.appendChild(el('p', 'ac-muted', '搜尋全部學生（不論有沒有加入班級），結果會標示是一般學生、或在哪位老師的哪個班級。'));
        const f = el('form', 'ac-bar'); f.setAttribute('role', 'search'); const gl = el('label', 'ac-bar__q'); gl.appendChild(el('span', null, '學生顯示名稱或帳號')); const gi = el('input'); gi.type = 'search'; gi.id = 'ac-gsearch'; gi.maxLength = 40; gi.autocomplete = 'off'; gl.appendChild(gi); f.appendChild(gl);
        const gb = el('button', 'ds-btn ds-btn--deep ds-btn--sm', '搜尋全站學生'); gb.type = 'submit'; gb.id = 'ac-gsearch-go'; f.appendChild(gb); gs.appendChild(f);
        const gbox = el('div'); gbox.id = 'ac-gbox'; gs.appendChild(gbox); m.appendChild(gs);
        f.addEventListener('submit', function (e) {
            e.preventDefault(); const q = gi.value.trim(); clear(gbox);
            if (!q) { gbox.appendChild(stateBox('empty', '請輸入要搜尋的顯示名稱或帳號。')); return; }
            const sq = seq; clear(gbox);
            listPage(gbox, { key: 'students', searchLabel: '搜尋結果', placeholder: '', state: { search: q }, empty: '找不到符合的學生。', sorts: [['last_login', '最近登入'], ['created', '建立時間'], ['stars', '星星數'], ['name', '顯示名稱']],
                fetch: function (st) { return call({ action: 'admin_search_students_global', page: st.page, search: st.search, sort: st.sort, order: st.order }); },
                item: function (it) { return studentItem(it, true); },
                exportBtn: function (st) { return exportButton('匯出目前搜尋結果（全部頁面）', '全站學生搜尋結果', function () { return { action: 'admin_export', kind: 'students_search', scope: 'all', search: st.search, sort: st.sort, order: st.order }; }, 'students-search', 'ac-export-global'); } });
            void sq;
        });
        const th = el('section', 'ac-sec'); th.appendChild(el('h3', 'ac-sec__h', '教師')); m.appendChild(th);
        listPage(th, { key: 'teachers', searchLabel: '搜尋教師', placeholder: '顯示名稱、帳號或學校', empty: '還沒有教師帳號。', sorts: [['created', '建立時間'], ['last_login', '最近登入'], ['name', '顯示名稱'], ['classes', '班級數']],
            fetch: function (st) { return call({ action: 'admin_list_teachers_paged', page: st.page, search: st.search, sort: st.sort, order: st.order }); },
            item: function (t) {
                return infoCard(t.display_name + (t.verified ? '（管理員確認）' : ''), [['帳號：', t.login_id], ['學校：', t.school_name || '—'], ['狀態：', t.status === 'active' ? '使用中' : '已停用'], ['班級（使用中／封存）：', t.classes_active + '／' + t.classes_archived], ['在班學生：', String(t.students)], ['最近登入：', when(t.last_login_at)]],
                    [btn('查看班級', function () { push(t.display_name, function (s) { viewClasses(s, t); }); }, 'btn-view ac-open')], 'ac-item--teacher');
            } });
    }
    function viewClasses(s, t) {
        const m = main(); m.appendChild(el('h2', 'ac-h', t.display_name + ' 的班級'));
        m.appendChild(el('p', 'ac-muted', '學校：' + (t.school_name || '—') + '　帳號：' + t.login_id));
        listPage(m, { key: 'classes', searchLabel: '搜尋班級', placeholder: '班級名稱', empty: '這位教師還沒有建立班級。', sorts: [['created', '建立時間'], ['activity', '最近活動'], ['name', '班級名稱'], ['students', '學生數']],
            fetch: function (st) { return call({ action: 'admin_list_classes', teacher_id: t.teacher_id, page: st.page, search: st.search, sort: st.sort, order: st.order }); },
            exportBtn: function () { return exportButton('匯出此教師班級摘要', t.display_name + ' 班級摘要', function () { return { action: 'admin_export', kind: 'teacher_summary', teacher_id: t.teacher_id }; }, 'teacher-classes', 'ac-export-teacher'); },
            item: function (c) {
                return infoCard(c.class_name, [['班級代碼：', c.code_masked], ['狀態：', c.status === 'active' ? '使用中' : '已封存'], ['學生數：', String(c.student_count)], ['島嶼任務／測驗：', c.task_count + '／' + c.quiz_count], ['最近活動：', when(c.last_activity_at)]],
                    [btn('查看班級學生', function () { push(c.class_name, function (s2) { viewClassStudents(s2, c); }); }, 'btn-view ac-open')], 'ac-item--class');
            } });
    }
    async function viewClassStudents(s, c) {
        const m = main(); m.appendChild(el('h2', 'ac-h', c.class_name));
        const sum = el('section', 'ac-sec'); sum.id = 'ac-class-summary'; sum.appendChild(lifeRing()); m.appendChild(sum);
        const ex = el('div', 'ac-actions');
        ex.appendChild(exportButton('匯出班級學生總表', c.class_name + ' 學生總表', function () { return { action: 'admin_export', kind: 'class', class_id: c.class_id }; }, 'class-students', 'ac-export-class'));
        ex.appendChild(exportButton('匯出班級任務與測驗完成情形', c.class_name + ' 任務完成情形', function () { return { action: 'admin_export', kind: 'class_tasks', class_id: c.class_id }; }, 'class-tasks', 'ac-export-class-tasks'));
        m.appendChild(ex);
        call({ action: 'admin_class_summary', class_id: c.class_id }).then(function (r) {
            if (!r || stale(s)) return; clear(sum);
            if (r.status !== 'success') { sum.appendChild(stateBox('error', errText(r))); return; }
            const x = r.summary; sum.appendChild(el('h3', 'ac-sec__h', '班級摘要'));
            sum.appendChild(el('p', 'ac-item__l', '學生 ' + x.student_count + ' 人；平均星星 ' + x.avg_stars + '／54；平均完成度 ' + x.avg_completion + '%。'));
            sum.appendChild(el('p', 'ac-item__l', x.islands.map(function (i) { return i.island + ' ' + i.avg_completion + '%'; }).join('　')));
            x.tasks.forEach(function (t) { sum.appendChild(el('p', 'ac-item__l', '島嶼任務「' + t.title + '」：' + (t.error ? t.error : (t.rate === null ? '無法計算' : t.completed + '／' + t.total + '（' + t.rate + '%）')) + (t.closed ? '　已關閉' : ''))); });
            x.quizzes.forEach(function (t) { sum.appendChild(el('p', 'ac-item__l', '老師測驗「' + t.title + '」：已送出 ' + t.submitted + '／' + t.roster + (t.status === 'open' ? '' : '　已關閉'))); });
        });
        const box = el('section', 'ac-sec'); box.appendChild(el('h3', 'ac-sec__h', '班級學生')); m.appendChild(box);
        listPage(box, { key: 'students', order: 'asc', searchLabel: '搜尋班級學生', placeholder: '顯示名稱或帳號', empty: '這個班級目前沒有學生。', sorts: [['name', '顯示名稱'], ['stars', '星星數'], ['last_login', '最近登入']],
            fetch: function (st) { return call({ action: 'admin_class_students', class_id: c.class_id, page: st.page, search: st.search, sort: st.sort, order: st.order }); },
            item: function (it) {
                const card = studentItem(it, false); const l = el('p', 'ac-item__l', '完成度 ' + it.completion + '%　六島星數：' + (it.islands || []).join('／')); card.insertBefore(l, card.querySelector('.ac-item__act')); return card;
            } });
    }

    /* ---------- 教師帳號管理／學生密碼協助（沿用既有安全 API 與面板） ---------- */
    function viewTeacherAccounts() {
        const m = main(); m.appendChild(el('h2', 'ac-h', '教師帳號管理'));
        m.appendChild(el('p', 'ac-muted', '教師可自行註冊，不需要管理員核准；「管理員確認」是另外的選用標示，不會自動給予。這裡不會顯示任何密碼雜湊。'));
        if (typeof AdminTeachers !== 'undefined') AdminTeachers.enter(true);
    }
    function viewStudentHelp(s, sid, nickname) {
        const m = main(); m.appendChild(el('h2', 'ac-h', '學生帳號與密碼協助'));
        if (typeof AdminStudents !== 'undefined') { AdminStudents.enter(); if (sid) AdminStudents.pick(sid, nickname); }
    }

    /* ---------- 資料匯出中心 ---------- */
    function viewExport() {
        const m = main(); m.appendChild(el('h2', 'ac-h', '資料匯出中心'));
        m.appendChild(el('p', 'ac-muted', '匯出檔為 UTF-8 CSV（可直接用試算表開啟）。檔案內含學生資料，帳號已遮罩；請妥善保管，不要轉寄。'));
        const a = el('section', 'ac-sec'); a.appendChild(el('h3', 'ac-sec__h', '整體統計'));
        a.appendChild(exportButton('匯出整體統計', '整體統計', function () { return { action: 'admin_export', kind: 'overall' }; }, 'overall', 'ac-export-overall')); m.appendChild(a);
        const b = el('section', 'ac-sec'); b.appendChild(el('h3', 'ac-sec__h', '學生名單（可輸入關鍵字，匯出全部符合的頁面）'));
        const f = el('div', 'atp-form'); const l1 = el('label'); l1.appendChild(el('span', null, '關鍵字（可留空）')); const q = el('input'); q.id = 'ac-ex-q'; q.maxLength = 40; q.autocomplete = 'off'; l1.appendChild(q); f.appendChild(l1);
        const l2 = el('label'); l2.appendChild(el('span', null, '範圍')); const sc = el('select'); sc.id = 'ac-ex-scope'; [['independent', '一般學生（未加入班級）'], ['all', '全部學生']].forEach(function (x) { const o = el('option', null, x[1]); o.value = x[0]; sc.appendChild(o); }); l2.appendChild(sc); f.appendChild(l2);
        f.appendChild(exportButton('匯出學生名單', '學生名單', function () { return { action: 'admin_export', kind: 'students_search', scope: sc.value, search: q.value.trim() }; }, 'student-list', 'ac-export-list')); b.appendChild(f); m.appendChild(b);
        const c = el('section', 'ac-sec'); c.appendChild(el('h3', 'ac-sec__h', '個別學生、班級與教師的匯出'));
        c.appendChild(el('p', 'ac-muted', '個別學生完整紀錄：進入「一般學生」或「教師與班級」→ 學生詳細頁。班級總表、班級任務、教師班級摘要：進入「教師與班級」→ 教師 → 班級。'));
        c.appendChild(btn('前往教師與班級', function () { push('教師與班級', viewTeachers); }, 'btn-view')); m.appendChild(c);
        const d = el('section', 'ac-sec ac-legacy'); d.appendChild(el('h3', 'ac-sec__h', '學習紀錄分析（進階）'));
        d.appendChild(el('p', 'ac-muted', '這是原本的學習紀錄儀表板（篩選、概念分析、易錯題）。資料量大時讀取較久，所以只有按下按鈕才會載入。'));
        const lm = el('p', 'ac-muted', ''); lm.id = 'ac-legacy-msg'; lm.setAttribute('role', 'alert'); d.appendChild(lm);
        d.appendChild(btn('載入學習紀錄分析', function () { if (typeof openLegacyDashboard === 'function') openLegacyDashboard(); }, 'ds-btn ds-btn--gold ds-btn--sm', 'ac-legacy-open')); m.appendChild(d);
    }

    /* ---------- 稽核與系統狀態 ---------- */
    async function viewSystem(s) {
        const m = main(); m.appendChild(el('h2', 'ac-h', '稽核與系統狀態')); const box = el('div'); box.id = 'ac-system'; box.appendChild(lifeRing()); m.appendChild(box);
        const r = await call({ action: 'admin_system_status' }); if (!r || stale(s)) return; clear(box);
        if (r.status !== 'success') { box.appendChild(stateBox('error', errText(r), function () { run(); })); }
        else {
            const x = r.system, sec = el('section', 'ac-sec'); sec.appendChild(el('h3', 'ac-sec__h', '版本與資料表'));
            sec.appendChild(el('p', 'ac-item__l', '後端版本：' + x.version + '　老師測驗資料表：' + (x.quiz_schema_ready ? '已建立' : '尚未建立')));
            const ul = el('ul', 'ac-flags'); x.sheets.forEach(function (sh) { ul.appendChild(el('li', null, sh.name + '：' + (sh.exists ? sh.rows + ' 列' : '尚未建立'))); }); sec.appendChild(ul);
            const fl = el('h3', 'ac-sec__h', '功能開關'); sec.appendChild(fl); const u2 = el('ul', 'ac-flags'); Object.keys(x.flags).forEach(function (k) { u2.appendChild(el('li', null, k + '：' + (x.flags[k] === 'on' ? '開啟' : '關閉'))); }); sec.appendChild(u2); box.appendChild(sec);
        }
        const au = el('section', 'ac-sec'); au.id = 'ac-audit'; au.appendChild(el('h3', 'ac-sec__h', '稽核紀錄（最近 50 筆）')); box.appendChild(au); au.appendChild(lifeRing());
        const a = await call({ action: 'admin_list_audit', limit: 50 }); if (!a || stale(s)) return; au.removeChild(au.lastChild);
        if (a.status !== 'success') { au.appendChild(stateBox('error', errText(a))); return; }
        const F = { pin_code_issued: '舊版啟用流程（核發）', pin_code_revoked: '舊版啟用流程（作廢）', pin_activated: '啟用密碼', pin_reset: '重設密碼', pin_recovery: '密碼重設碼重設密碼', real_name: '姓名', display_name: '顯示名稱', teacher_verified: '教師確認', class_member: '班級關係' };
        if (!a.audit.length) au.appendChild(el('p', 'ac-muted', '目前沒有稽核紀錄。'));
        a.audit.forEach(function (x) { au.appendChild(el('p', 'ac-item__l ac-log', when(x.changed_at) + '　' + (F[x.field] || x.field) + '　' + x.changed_by_role)); });
        au.appendChild(el('p', 'ac-muted', '共 ' + a.total + ' 筆。稽核畫面不顯示密碼或重設碼內容。'));
    }

    /* ---------- 進出 ---------- */
    function open() { switchScreen('screen-admin-center'); home(); if (typeof UIKit !== 'undefined' && UIKit.hydrate) UIKit.hydrate($('screen-admin-center')); }
    function init() {
        const h = $('ac-home-btn'); if (h) h.addEventListener('click', home);
        const b = $('ac-back'); if (b) b.addEventListener('click', back);
        const l = $('ac-logout'); if (l) l.addEventListener('click', function () { logoutToRoleSelect(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    function reset() { seq++; trail = []; exporting = false; hidePanels(); const m = main(); if (m) clear(m); const c = $('ac-crumbs'); if (c) clear(c); }
    return { open: open, reset: reset, home: home, back: back, go: push, _trail: function () { return trail.map(function (t) { return t.label; }); } };
})();
