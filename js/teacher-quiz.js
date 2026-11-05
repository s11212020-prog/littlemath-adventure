/* 階段 10：教師出題（建立題目／測驗、我的題庫、我出的任務或測驗、學生作答結果）
   * 兩種出題方式可以混用：系統出題（先看預覽，可修改、刪除、新增、換順序、單題重新產生）與老師自己輸入（只有「題目內容」是必填）。
   * 系統產生的題目只是預覽：儲存成草稿、按「發布」並確認後才會指派給班級，絕不會直接發給學生。
   * 已發布的測驗題目會固定；要修改請用「建立新版本」。沒有填答案的題目不會自動批改，會顯示「待老師檢視」，沒批改前不算 0 分。
   * 後端會再次驗證教師身分與班級歸屬；這裡只負責畫面。文字一律用 textContent 寫入；不使用瀏覽器儲存空間。 */
const TeacherQuiz = (function () {
    const U = QZU, $ = function (id) { return document.getElementById(id); };
    const MODES = [
        ['practice', '練習模式', '送出後學生馬上看到對錯、正確答案與解析（適合自己練習）。'],
        ['exam', '測驗模式（預設）', '送出後學生只看到「已送出」；你按「公布結果」後才看到對錯、分數、正解與解析。'],
        ['submitted_only', '只顯示已送出', '學生只知道有送出；公布結果前不顯示任何成績。'],
        ['teacher_release', '老師稍後公布', '先收卷，之後由你決定何時公布結果。']
    ];
    const QT = [['short', '簡答題'], ['choice', '選擇題'], ['remainder', '餘數題（商＋餘數）'], ['open', '開放題（老師檢視）']];
    const OPS = [['+', 'add', '加法 ＋'], ['-', 'sub', '減法 －'], ['*', 'mul', '乘法 ×'], ['/', 'div', '除法 ÷']];
    const OP_TXT = { '+': '加法', '-': '減法', '*': '乘法', '/': '除法', wp: '應用題', mixed: '混合', other: '其他', '': '未分類' };
    const DIFF_TXT = { '': '未指定', '1': '基礎', '2': '進階', '3': '挑戰' };
    const S = { view: '', B: null, genParams: null, classes: null, avail: null, busy: false, saving: false, msg: '', key: 0, bank: { page: 1, filters: {} } };

    function token() { return (AuthSession.teacher && AuthSession.teacher.token) || ''; }
    async function call(payload) {
        if (typeof GAS_URL !== 'string' || GAS_URL.indexOf('http') !== 0) return { status: 'error', code: 'DEMO', message: '目前是示範模式（沒有連到後端），出題功能需要連線後才能使用。' };
        const r = await U.withTimeout(apiCall(Object.assign({ token: token() }, payload)));
        if (r && r.code === 'SESSION_INVALID') { if (typeof TeacherPortal !== 'undefined' && TeacherPortal.sessionLost) TeacherPortal.sessionLost(); return null; }
        return r || { status: 'error', message: '沒有收到回應' };
    }

    /* ---------- 教師首頁入口：後端功能有開才顯示 ---------- */
    async function onHome() {
        const box = $('th-quiz'); if (!box) return;
        box.hidden = true; S.avail = null;
        const r = await call({ action: 'quiz_list' });
        if (r && r.status === 'success') { S.avail = true; box.hidden = false; } else { S.avail = false; box.hidden = true; }
    }

    /* ---------- 畫面骨架 ---------- */
    function ensure() {
        if ($('screen-tq')) return;
        const s = U.mkScreen('screen-tq', 'tq-screen', function (c) {
            const head = U.el('header', 'td-head qz-head');
            const t = U.el('div', 'td-head__title'); const ic = U.el('span', 'td-head__icon'); ic.setAttribute('data-icon', 'book'); ic.setAttribute('data-size', '52'); t.appendChild(ic);
            const tt = U.el('div'); tt.appendChild(U.el('div', 'admin-brand', '小小算術家：六島大冒險｜老師出題')); const h = U.el('h1', 'td-title', '老師出題'); h.id = 'tq-h'; tt.appendChild(h); t.appendChild(tt); head.appendChild(t);
            const act = U.el('div', 'td-head__actions'); act.appendChild(U.btn('回教師首頁', function () { leaveBuilder(function () { switchScreen('screen-teacher-home'); }); }, 'ds-btn ds-btn--ghost ds-btn--sm', 'tq-home')); head.appendChild(act); c.appendChild(head);
            const nav = U.el('nav', 'qz-tabs'); nav.setAttribute('aria-label', '出題功能');
            [['new', '建立新測驗'], ['bank', '我的題庫'], ['list', '我出的任務或測驗'], ['results', '學生作答結果']].forEach(function (x) { nav.appendChild(U.btn(x[1], function () { say(''); show(x[0]); }, 'btn-view qz-tab', 'tq-tab-' + x[0])); });
            c.appendChild(nav);
            const msg = U.el('p', 'tab-note qz-msg', ''); msg.id = 'tq-msg'; msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite'); c.appendChild(msg);
            const m = U.el('main', 'qz-main'); m.id = 'tq-main'; m.tabIndex = -1; c.appendChild(m);
        });
        if (typeof UIKit !== 'undefined' && UIKit.hydrate) UIKit.hydrate(s);
    }
    function say(t, bad) { const e = $('tq-msg'); if (e) { e.textContent = t || ''; e.classList.toggle('is-bad', !!bad); } }
    function main() { return U.clear($('tq-main')); }
    function markTab(v) { document.querySelectorAll('.qz-tab').forEach(function (b) { b.classList.toggle('is-cur', b.id === 'tq-tab-' + v); if (b.id === 'tq-tab-' + v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
    async function leaveBuilder(next) {
        if (S.view === 'builder' && S.B && S.B.dirty) {
            const ok = await U.modal({ title: '這份測驗還沒有儲存', lines: ['離開後，剛剛的修改不會保留。'], ok: '不儲存，離開', cancel: '回去繼續編輯', focusCancel: true });
            if (!ok) return;
        }
        S.B = null; say(''); next();
    }
    function show(v, arg) {
        const go = function () { S.view = v; ensure(); markTab(v === 'builder' ? 'new' : ((v === 'attempt' || v === 'assignment' || v === 'class_results') ? 'results' : v)); switchScreen('screen-tq');
            ({ new: viewNew, builder: viewBuilder, bank: viewBank, list: viewList, results: viewResults, class_results: viewClassResults, assignment: viewAssignment, attempt: viewAttempt }[v] || viewList)(arg); };
        if (S.view === 'builder' && S.B && S.B.dirty && v !== 'builder') { leaveBuilder(go); return; }
        if (v !== 'builder') S.B = null;
        go();
    }
    function open() { ensure(); show('list'); }
    function openNew() { ensure(); S.B = newDraft(); show('builder'); }
    function openBank() { ensure(); show('bank'); }
    function openResults() { ensure(); show('results'); }

    /* ---------- 草稿資料 ---------- */
    function newItem(over) { return Object.assign({ _k: ++S.key, content: '', correct_answer: '', qtype: 'short', options: ['', ''], points: '', explanation: '', context: '', op: '', difficulty: '', tags: [], gen_meta: null, source: 'manual', answer_confirmed: false, preview: false }, over || {}); }
    function fromServer(it) {
        return newItem({ item_id: it.item_id, content: it.content, correct_answer: it.correct_answer, qtype: it.qtype, options: (it.options || []).map(function (o) { return o.text; }), points: it.points === 1 ? '' : String(it.points),
            explanation: it.explanation, context: it.context, op: it.op, difficulty: it.difficulty, tags: it.tags || [], gen_meta: it.gen_meta, source: it.source, bank_question_id: it.bank_question_id });
    }
    function newDraft() { return { quizId: '', status: 'draft', title: '', description: '', mode: 'exam', showScore: false, attempts: 1, shuffle: false, items: [], dirty: false, assignments: [], genParams: null, version: 1 }; }
    function fromQuiz(r) {
        const q = r.quiz; return { quizId: q.quiz_id, status: q.status, title: q.title, description: q.description, mode: q.feedback_mode, showScore: !!q.show_score, attempts: q.attempts_allowed, shuffle: !!q.shuffle_items, items: (r.items || []).map(fromServer),
            dirty: false, assignments: r.assignments || [], genParams: q.gen_params || null, version: q.version || 1, defaultTitle: q.title };
    }
    function itemPayload(it) {
        const o = { content: it.content, qtype: it.qtype, correct_answer: it.correct_answer, explanation: it.explanation, context: it.context, op: it.op, difficulty: it.difficulty, tags: it.tags, source: it.source };
        if (it.item_id) o.item_id = it.item_id;
        if (it.bank_question_id) o.bank_question_id = it.bank_question_id;
        if (it.points !== '' && it.points !== undefined) o.points = Number(it.points);
        if (it.qtype === 'choice') o.options = it.options.map(function (t) { return t; });
        if (it.gen_meta) { o.gen_meta = it.gen_meta; if (it.answer_confirmed) o.answer_confirmed = true; }
        return o;
    }
    function isStale(it) { const g = it.gen_meta; return !!(g && ((g.stale && !it.answer_confirmed) || (g.c !== undefined && it.content !== g.c && !it.answer_confirmed && it.correct_answer === g.ans))); }

    /* ---------- 建立新測驗（入口：選擇出題方式） ---------- */
    function viewNew() { S.B = S.B || newDraft(); viewBuilder(); }

    /* ---------- 編輯器 ---------- */
    function field(label, node, cls) { const l = U.el('label', 'qz-field ' + (cls || '')); l.appendChild(U.el('span', 'qz-field__l', label)); l.appendChild(node); return l; }
    function input(id, val, ph, max, type) { const i = document.createElement('input'); i.type = type || 'text'; i.id = id; i.value = val === undefined || val === null ? '' : val; if (ph) i.placeholder = ph; if (max) i.maxLength = max; i.autocomplete = 'off'; i.spellcheck = false; return i; }
    function area(id, val, ph, max, rows) { const t = document.createElement('textarea'); t.id = id; t.value = val || ''; if (ph) t.placeholder = ph; t.maxLength = max || 300; t.rows = rows || 2; return t; }
    function sel(id, opts, val) { const s = document.createElement('select'); s.id = id; opts.forEach(function (o) { const e = document.createElement('option'); e.value = o[0]; e.textContent = o[1]; s.appendChild(e); }); s.value = val; return s; }
    function dirty() { if (S.B) S.B.dirty = true; }

    async function viewBuilder() {
        ensure(); S.view = 'builder'; markTab('new'); switchScreen('screen-tq');
        const B = S.B; const m = main();
        if (!B) { m.appendChild(U.stateBox('empty', '沒有正在編輯的測驗。')); return; }
        if (B.status !== 'draft') { viewLocked(m, B); return; }
        $('tq-h').textContent = B.quizId ? '編輯測驗草稿' : '建立新測驗';
        const sec1 = U.el('section', 'qz-sec'); sec1.appendChild(U.el('h2', 'qz-h', '測驗設定'));
        const t = input('tq-title', B.title, '不填也可以，系統會自動命名', 40); t.addEventListener('input', function () { B.title = t.value; dirty(); }); sec1.appendChild(field('測驗名稱（選填）', t));
        const d = area('tq-desc', B.description, '給學生的說明（選填）', 200, 2); d.addEventListener('input', function () { B.description = d.value; dirty(); }); sec1.appendChild(field('測驗說明（選填）', d));
        const fs = U.el('fieldset', 'qz-fs'); fs.appendChild(U.el('legend', null, '作答後學生看到什麼'));
        MODES.forEach(function (x) {
            const l = U.el('label', 'tp-radio qz-radio'); const r = document.createElement('input'); r.type = 'radio'; r.name = 'tq-mode'; r.value = x[0]; r.id = 'tq-mode-' + x[0]; r.checked = B.mode === x[0];
            r.addEventListener('change', function () { B.mode = x[0]; dirty(); syncScore(); }); l.appendChild(r); const sp = U.el('span'); sp.appendChild(U.el('strong', null, x[1])); sp.appendChild(document.createTextNode('：' + x[2])); l.appendChild(sp); fs.appendChild(l);
        });
        sec1.appendChild(fs);
        const sc = U.el('label', 'tp-check qz-check'); const sci = document.createElement('input'); sci.type = 'checkbox'; sci.id = 'tq-show-score'; sci.checked = !!B.showScore; sci.addEventListener('change', function () { B.showScore = sci.checked; dirty(); });
        sc.appendChild(sci); sc.appendChild(U.el('span', null, '送出後顯示分數（只適用「測驗模式」；預設關閉，對錯與正解仍等你公布）')); sec1.appendChild(sc);
        function syncScore() { sc.hidden = B.mode !== 'exam'; }
        syncScore();
        const at = sel('tq-attempts', [['1', '1 次（預設）'], ['2', '2 次'], ['3', '3 次']], String(B.attempts)); at.addEventListener('change', function () { B.attempts = Number(at.value); dirty(); });
        sec1.appendChild(field('可以作答幾次（多次作答成績採最高分）', at));
        const sh = U.el('label', 'tp-check qz-check'); const shi = document.createElement('input'); shi.type = 'checkbox'; shi.id = 'tq-shuffle'; shi.checked = !!B.shuffle; shi.addEventListener('change', function () { B.shuffle = shi.checked; dirty(); });
        sh.appendChild(shi); sh.appendChild(U.el('span', null, '每位學生的題目順序隨機')); sec1.appendChild(sh);
        m.appendChild(sec1);

        m.appendChild(genPanel());
        const sec2 = U.el('section', 'qz-sec'); const h2 = U.el('h2', 'qz-h', '題目'); h2.id = 'tq-items-h'; sec2.appendChild(h2);
        sec2.appendChild(U.el('p', 'qz-muted', '只有「題目內容」是必填。沒有填答案的題目不會自動批改，會顯示「待老師檢視」。'));
        const list = U.el('div', 'qz-items'); list.id = 'tq-items'; sec2.appendChild(list);
        const add = U.el('div', 'qz-actions');
        add.appendChild(U.btn('新增一題', function () { B.items.push(newItem()); dirty(); renderItems(); const c = document.querySelectorAll('.tq-content'); if (c.length) c[c.length - 1].focus(); }, 'btn-view', 'tq-add-item'));
        add.appendChild(U.btn('從我的題庫加入', function () { bankPicker(); }, 'btn-view', 'tq-from-bank'));
        add.appendChild(U.btn('清除全部題目', async function () { if (!B.items.length) return; if (await U.modal({ title: '清除全部題目？', lines: ['草稿裡的題目會全部移除（儲存前還可以離開不儲存）。'], ok: '清除', focusCancel: true })) { B.items = []; dirty(); renderItems(); } }, 'btn-view', 'tq-clear-items'));
        sec2.appendChild(add); m.appendChild(sec2);
        const foot = U.el('div', 'qz-actions qz-foot');
        foot.appendChild(U.btn('儲存草稿', function () { save(); }, 'ds-btn ds-btn--sea ds-btn--sm', 'tq-save'));
        foot.appendChild(U.btn('儲存並指派給班級…', function () { publishFlow(); }, 'ds-btn ds-btn--gold ds-btn--sm', 'tq-publish'));
        if (B.quizId) foot.appendChild(U.btn('封存這份草稿', function () { archiveQuiz(B.quizId, true); }, 'btn-view', 'tq-archive'));
        m.appendChild(foot);
        const pub = U.el('section', 'qz-sec'); pub.id = 'tq-assign'; pub.hidden = true; m.appendChild(pub);
        renderItems();
    }
    function viewLocked(m, B) {
        $('tq-h').textContent = '測驗（已發布）';
        const sec = U.el('section', 'qz-sec'); sec.appendChild(U.el('h2', 'qz-h', B.title));
        sec.appendChild(U.el('p', 'qz-muted', '這份測驗已經發布，題目已固定，不能直接修改（學生可能已經在作答）。要修改請建立新版本。'));
        sec.appendChild(U.btn('建立新版本', async function () { const r = await call({ action: 'quiz_clone', quiz_id: B.quizId }); if (!r || r.status !== 'success') { say(r ? U.errText(r) : '', true); return; } S.B = fromQuiz(r); viewBuilder(); say('已建立新版本草稿，可以修改後再指派。'); }, 'ds-btn ds-btn--gold ds-btn--sm', 'tq-clone'));
        B.items.forEach(function (it, i) { sec.appendChild(U.el('p', 'qz-ro', (i + 1) + '. ' + it.content + (it.correct_answer !== '' ? '　（答案：' + it.correct_answer + '）' : '　（待老師檢視）'))); });
        m.appendChild(sec);
        const sec2 = U.el('section', 'qz-sec'); sec2.appendChild(U.el('h3', 'qz-h', '指派給其他班級')); const box = U.el('div'); box.id = 'tq-assign'; sec2.appendChild(box); m.appendChild(sec2); assignPanel(box, true);
    }

    function genPanel() {
        const sec = U.el('section', 'qz-sec qz-gen'); sec.appendChild(U.el('h2', 'qz-h', '系統出題'));
        sec.appendChild(U.el('p', 'qz-muted', '選好條件按「產生題目預覽」。產生的題目只是預覽，可以修改、刪除、換順序，確認後再儲存與指派。'));
        const fs = U.el('fieldset', 'qz-fs'); fs.appendChild(U.el('legend', null, '運算（可複選，預設四則混合）'));
        OPS.forEach(function (o) { const l = U.el('label', 'tp-check qz-check'); const i = document.createElement('input'); i.type = 'checkbox'; i.id = 'tq-gen-op-' + o[1]; i.checked = true; i.addEventListener('change', syncRem); l.appendChild(i); l.appendChild(U.el('span', null, o[2])); fs.appendChild(l); });
        sec.appendChild(fs);
        const row = U.el('div', 'qz-row');
        row.appendChild(field('題數', input('tq-gen-count', '5', '', 2, 'number')));
        row.appendChild(field('難度', sel('tq-gen-diff', [['1', '基礎（預設）'], ['2', '進階'], ['3', '挑戰']], '1')));
        row.appendChild(field('數字最小值（選填）', input('tq-gen-min', '', '', 4, 'number')));
        row.appendChild(field('數字最大值（選填）', input('tq-gen-max', '', '', 4, 'number')));
        sec.appendChild(row);
        [['tq-gen-word', '加入應用題（文字情境）', false], ['tq-gen-rem', '除法題要有餘數（答案要填商和餘數）', false], ['tq-gen-shuffle', '混合題型順序', true]].forEach(function (x) {
            const l = U.el('label', 'tp-check qz-check'); l.id = x[0] + '-wrap'; const i = document.createElement('input'); i.type = 'checkbox'; i.id = x[0]; i.checked = x[2]; l.appendChild(i); l.appendChild(U.el('span', null, x[1])); sec.appendChild(l);
        });
        function syncRem() { const w = $('tq-gen-rem-wrap'); if (w) w.hidden = !($('tq-gen-op-div') && $('tq-gen-op-div').checked); }
        setTimeout(syncRem, 0);
        sec.appendChild(U.btn('產生題目預覽', function () { generate(); }, 'ds-btn ds-btn--deep ds-btn--sm', 'tq-gen-go'));
        const e = U.el('p', 'ds-error en-error', ''); e.id = 'tq-gen-err'; e.setAttribute('role', 'alert'); sec.appendChild(e);
        return sec;
    }
    function genParams() {
        const ops = OPS.filter(function (o) { return $('tq-gen-op-' + o[1]).checked; }).map(function (o) { return o[0]; });
        const p = { ops: ops, count: Number($('tq-gen-count').value), difficulty: Number($('tq-gen-diff').value), word: $('tq-gen-word').checked, remainder: $('tq-gen-rem').checked && ops.indexOf('/') >= 0, shuffle: $('tq-gen-shuffle').checked };
        const lo = $('tq-gen-min').value.trim(), hi = $('tq-gen-max').value.trim(); if (lo !== '') p.min = Number(lo); if (hi !== '') p.max = Number(hi);
        return p;
    }
    async function generate() {
        const err = $('tq-gen-err'); err.textContent = '';
        const p = genParams(); if (!p.ops.length) { err.textContent = '請至少選一種運算。'; return; }
        const B = S.B; if (B.items.length + p.count > 30) { err.textContent = '一份測驗最多 30 題，目前已有 ' + B.items.length + ' 題。'; return; }
        const b = $('tq-gen-go'); b.disabled = true;
        try {
            const r = await call({ action: 'quiz_generate_items', params: p }); if (!r) return;
            if (r.status !== 'success') { err.textContent = U.errText(r); return; }
            r.items.forEach(function (it) { B.items.push(fromGenerated(it)); }); B.genParams = r.params; dirty(); renderItems(); say('已產生 ' + r.items.length + ' 題預覽。這些題目還沒有儲存，也還沒有發給學生。');
        } finally { b.disabled = false; }
    }
    function fromGenerated(it) {
        return newItem({ content: it.content, correct_answer: it.correct_answer, qtype: it.qtype, options: (it.options || []).map(function (o) { return o.text !== undefined ? o.text : o; }), points: it.points === 1 ? '' : String(it.points), explanation: it.explanation || '', context: it.context || '', op: it.op, difficulty: it.difficulty || '', tags: it.tags || [], gen_meta: it.gen_meta, source: 'generated', preview: true });
    }
    async function regenerate(i) {
        const it = S.B.items[i], g = it.gen_meta; if (!g) return;
        const p = Object.assign({}, S.B.genParams || {}, { ops: [g.op], count: 1, shuffle: false, remainder: !!g.rem, word: !!g.word });
        const r = await call({ action: 'quiz_generate_items', params: p }); if (!r || r.status !== 'success' || !r.items.length) { say(r ? U.errText(r) : '', true); return; }
        const n = fromGenerated(r.items[0]); n.item_id = it.item_id; S.B.items[i] = n; dirty(); renderItems(); say('已重新產生第 ' + (i + 1) + ' 題。');
    }

    function renderItems() {
        const B = S.B, host = $('tq-items'); if (!host) return; U.clear(host);
        const h = $('tq-items-h'); if (h) h.textContent = '題目（共 ' + B.items.length + ' 題）';
        if (!B.items.length) host.appendChild(U.stateBox('empty', '還沒有題目。可以用上面的「系統出題」，或按「新增一題」自己輸入。'));
        B.items.forEach(function (it, i) { host.appendChild(itemCard(it, i)); });
    }
    function itemCard(it, i) {
        const B = S.B, c = U.el('article', 'tq-item qz-item'); c.setAttribute('data-i', String(i)); c.id = 'tq-item-' + i;
        const head = U.el('div', 'qz-item__head'); head.appendChild(U.el('h3', 'qz-item__h', '第 ' + (i + 1) + ' 題' + (it.source === 'generated' || it.gen_meta ? '（系統出題）' : '') + (it.preview ? '・預覽' : '')));
        const tools = U.el('div', 'qz-item__tools');
        const mv = function (d) { return function () { const j = i + d; if (j < 0 || j >= B.items.length) return; const t = B.items[i]; B.items[i] = B.items[j]; B.items[j] = t; dirty(); renderItems(); const n = $('tq-item-' + j); if (n) n.scrollIntoView({ block: 'nearest' }); }; };
        const up = U.btn('上移', mv(-1), 'btn-view qz-mini', 'tq-up-' + i); up.disabled = i === 0; const dn = U.btn('下移', mv(1), 'btn-view qz-mini', 'tq-down-' + i); dn.disabled = i === B.items.length - 1;
        tools.appendChild(up); tools.appendChild(dn);
        if (it.gen_meta) tools.appendChild(U.btn('重新產生這題', function () { regenerate(i); }, 'btn-view qz-mini', 'tq-regen-' + i));
        tools.appendChild(U.btn('存到題庫', function () { toBank(i); }, 'btn-view qz-mini', 'tq-tobank-' + i));
        tools.appendChild(U.btn('刪除', function () { B.items.splice(i, 1); dirty(); renderItems(); }, 'btn-view qz-mini qz-danger', 'tq-del-' + i));
        head.appendChild(tools); c.appendChild(head);
        const warn = U.el('div', 'qz-warn'); warn.id = 'tq-warn-' + i; warn.setAttribute('role', 'alert'); c.appendChild(warn);
        const syncWarn = function () {
            U.clear(warn); warn.hidden = !isStale(it); if (!isStale(it)) return;
            warn.appendChild(U.el('p', null, '這一題的題目改過了，原本的答案可能已經不相符。請重新核對答案，再按「我已核對答案」。'));
            warn.appendChild(U.btn('我已核對答案', function () { it.answer_confirmed = true; dirty(); syncWarn(); }, 'btn-view', 'tq-confirm-' + i));
        };
        const cx = area('tq-cx-' + i, it.context, '情境說明（選填，只支援文字）', 300, 2); cx.addEventListener('input', function () { it.context = cx.value; dirty(); }); c.appendChild(field('情境說明（選填）', cx));
        const ct = area('tq-ct-' + i, it.content, '例如：3 + 4 = ?', 300, 2); ct.className = 'tq-content'; ct.addEventListener('input', function () { it.content = ct.value; it.answer_confirmed = false; dirty(); syncWarn(); }); c.appendChild(field('題目內容（必填）', ct));
        const row = U.el('div', 'qz-row');
        const ty = sel('tq-qt-' + i, QT, it.qtype); ty.addEventListener('change', function () { it.qtype = ty.value; if (it.qtype === 'choice' && it.options.length < 2) it.options = ['', '']; if (it.qtype === 'open') it.correct_answer = ''; dirty(); renderItems(); }); row.appendChild(field('題型', ty));
        const pt = input('tq-pt-' + i, it.points, '預設 1 分', 5, 'text'); pt.addEventListener('input', function () { it.points = pt.value.trim(); dirty(); }); row.appendChild(field('配分（選填，預設 1 分）', pt));
        const df = sel('tq-df-' + i, [['', '未指定'], ['1', '基礎'], ['2', '進階'], ['3', '挑戰']], it.difficulty); df.addEventListener('change', function () { it.difficulty = df.value; dirty(); }); row.appendChild(field('難度', df));
        c.appendChild(row);
        const ans = U.el('div', 'qz-ans');
        if (it.qtype === 'short') {
            const a = input('tq-ans-' + i, it.correct_answer, '不填＝待老師檢視（不會自動批改）', 100); a.className = 'tq-answer'; a.addEventListener('input', function () { it.correct_answer = a.value; dirty(); syncWarn(); }); ans.appendChild(field('正確答案（選填）', a));
        } else if (it.qtype === 'remainder') {
            const parts = String(it.correct_answer || '').split('|'); const rr = U.el('div', 'qz-row');
            const q = input('tq-remq-' + i, parts[0] || '', '', 8), r = input('tq-remr-' + i, parts[1] || '', '', 8);
            const upd = function () { const a = q.value.trim(), b = r.value.trim(); it.correct_answer = (a === '' && b === '') ? '' : a + '|' + b; dirty(); syncWarn(); };
            q.addEventListener('input', upd); r.addEventListener('input', upd); rr.appendChild(field('商（選填）', q)); rr.appendChild(field('餘數（選填）', r)); ans.appendChild(rr);
        } else if (it.qtype === 'choice') {
            const og = U.el('div', 'qz-opts'); og.setAttribute('role', 'group'); og.setAttribute('aria-label', '選項（點圓鈕設定正確答案）');
            it.options.forEach(function (t, k) {
                const id = String.fromCharCode(65 + k), l = U.el('div', 'qz-opt');
                const rd = document.createElement('input'); rd.type = 'radio'; rd.name = 'tq-corr-' + i; rd.id = 'tq-corr-' + i + '-' + id; rd.checked = it.correct_answer === id; rd.setAttribute('aria-label', '設為正確答案：選項 ' + id); rd.addEventListener('change', function () { it.correct_answer = id; dirty(); syncWarn(); });
                const tx = input('tq-opt-' + i + '-' + id, t, '選項 ' + id, 60); tx.addEventListener('input', function () { it.options[k] = tx.value; dirty(); });
                l.appendChild(rd); l.appendChild(U.el('span', 'qz-opt__id', id)); l.appendChild(tx);
                if (it.options.length > 2) l.appendChild(U.btn('移除', function () { it.options.splice(k, 1); if (it.correct_answer === id) it.correct_answer = ''; dirty(); renderItems(); }, 'btn-view qz-mini', 'tq-optdel-' + i + '-' + id));
                og.appendChild(l);
            });
            ans.appendChild(og);
            if (it.options.length < 6) ans.appendChild(U.btn('新增選項', function () { it.options.push(''); dirty(); renderItems(); }, 'btn-view qz-mini', 'tq-optadd-' + i));
            ans.appendChild(U.el('p', 'qz-muted', it.correct_answer ? '正確答案：選項 ' + it.correct_answer : '還沒選正確答案：這一題會顯示「待老師檢視」。'));
        } else ans.appendChild(U.el('p', 'qz-muted', '開放題不設定正確答案，學生送出後由你檢視並（選填）給分與評語。'));
        c.appendChild(ans);
        const ex = area('tq-ex-' + i, it.explanation, '解析（選填，公布結果後學生才看得到）', 300, 2); ex.addEventListener('input', function () { it.explanation = ex.value; dirty(); }); c.appendChild(field('解析（選填）', ex));
        syncWarn(); return c;
    }

    /* ---------- 儲存 ---------- */
    function collect() {
        const B = S.B;
        return { action: 'quiz_save', quiz_id: B.quizId || undefined, title: B.title.trim(), description: B.description.trim(), feedback_mode: B.mode, show_score: B.mode === 'exam' && !!B.showScore, attempts_allowed: Number(B.attempts) || 1,
            shuffle_items: !!B.shuffle, items: B.items.map(itemPayload), gen_params: B.genParams || undefined };
    }
    function localProblems() {
        const B = S.B, probs = [];
        if (!B.items.length) probs.push('至少要有一題。');
        B.items.forEach(function (it, i) {
            if (!String(it.content).trim()) probs.push('第 ' + (i + 1) + ' 題還沒有輸入題目內容。');
            if (it.points !== '' && (isNaN(Number(it.points)) || Number(it.points) < 0 || Number(it.points) > 100)) probs.push('第 ' + (i + 1) + ' 題的配分要是 0～100 的數字。');
            if (it.qtype === 'choice') { const t = it.options.map(function (x) { return String(x).trim(); }); if (t.some(function (x) { return !x; })) probs.push('第 ' + (i + 1) + ' 題有空白的選項。'); }
            if (isStale(it)) probs.push('第 ' + (i + 1) + ' 題的題目改過了，請重新核對答案（按「我已核對答案」）。');
        });
        return probs;
    }
    async function save(quiet) {
        const B = S.B; if (!B || S.saving) return false;
        const probs = localProblems(); if (probs.length) { say(probs.slice(0, 4).join(' '), true); return false; }
        S.saving = true; const b = $('tq-save'); if (b) b.disabled = true;
        try {
            const r = await call(collect()); if (!r) return false;
            if (r.status !== 'success') { say(U.errText(r), true); return false; }
            const keepGen = B.genParams; S.B = fromQuiz(r); S.B.genParams = keepGen; viewBuilder(); if (!quiet) say('已儲存草稿「' + S.B.title + '」。還沒有指派給任何班級。');
            return true;
        } finally { S.saving = false; const b2 = $('tq-save'); if (b2) b2.disabled = false; }
    }

    /* ---------- 指派／發布 ---------- */
    async function loadClasses() {
        const r = await call({ action: 'list_teacher_classes' });
        if (!r || r.status !== 'success') return { err: r ? U.errText(r) : '' };
        S.classes = (r.classes || []).filter(function (c) { return c.status !== 'archived'; }); return { classes: S.classes };
    }
    async function publishFlow() {
        const B = S.B; if (!(await save(true))) return;
        const box = $('tq-assign'); box.hidden = false; assignPanel(box, false); box.scrollIntoView({ block: 'nearest' });
    }
    async function assignPanel(box, already) {
        U.clear(box); box.appendChild(U.el('h2', 'qz-h', already ? '指派給其他班級' : '指派給班級'));
        box.appendChild(U.lifeRing('讀取班級…'));
        const lc = await loadClasses(); U.clear(box); box.appendChild(U.el('h2', 'qz-h', already ? '指派給其他班級' : '指派給班級'));
        if (lc.err) { box.appendChild(U.stateBox('error', lc.err)); return; }
        if (!lc.classes.length) { box.appendChild(U.stateBox('empty', '你還沒有使用中的班級。可以先保留成草稿，之後再指派。')); return; }
        const B = S.B, assigned = {}; (B.assignments || []).forEach(function (a) { if (a.status === 'open') assigned[a.class_id] = 1; });
        const fs = U.el('fieldset', 'qz-fs'); fs.appendChild(U.el('legend', null, '選擇班級（可複選）'));
        lc.classes.forEach(function (c) {
            const l = U.el('label', 'tp-check qz-check'); const i = document.createElement('input'); i.type = 'checkbox'; i.value = c.class_id; i.className = 'tq-class'; i.id = 'tq-cls-' + c.class_id; i.disabled = !!assigned[c.class_id];
            l.appendChild(i); l.appendChild(U.el('span', null, c.class_name + '（' + c.active_count + ' 人）' + (assigned[c.class_id] ? '　已有進行中的指派' : ''))); fs.appendChild(l);
        });
        box.appendChild(fs);
        const row = U.el('div', 'qz-row'); row.appendChild(field('開始日（選填）', input('tq-start', '', '', 10, 'date'))); row.appendChild(field('截止日（選填，含當天）', input('tq-due', '', '', 10, 'date'))); box.appendChild(row);
        const e = U.el('p', 'ds-error en-error', ''); e.id = 'tq-assign-err'; e.setAttribute('role', 'alert'); box.appendChild(e);
        const b = U.btn('確認並發布', async function () {
            e.textContent = ''; const ids = Array.prototype.map.call(box.querySelectorAll('.tq-class:checked'), function (x) { return x.value; });
            if (!ids.length) { e.textContent = '請至少選一個班級，或回去「儲存草稿」就好。'; return; }
            const names = lc.classes.filter(function (c) { return ids.indexOf(c.class_id) >= 0; }).map(function (c) { return c.class_name; });
            const ok = await U.modal({ title: already ? '要指派給這些班級嗎？' : '要發布並指派嗎？', lines: ['測驗：' + B.title, '班級：' + names.join('、'), '共 ' + B.items.length + ' 題；' + (MODES.filter(function (x) { return x[0] === B.mode; })[0] || ['', ''])[1] + '；可作答 ' + B.attempts + ' 次。'],
                list: ['發布後，題目就固定，不能直接修改（要改請建立新版本）。', '學生會在「我的班級 → 老師任務」看到這份測驗。', '沒有填答案的題目會顯示「待老師檢視」，不會自動算 0 分。'], ok: '發布', cancel: '再檢查一下', focusCancel: true });
            if (!ok) return;
            b.disabled = true;
            try {
                const p = { action: already ? 'quiz_assign' : 'quiz_publish', quiz_id: B.quizId, class_ids: ids }; const st = $('tq-start').value, du = $('tq-due').value; if (st) p.start_date = st; if (du) p.due_date = du;
                const r = await call(p); if (!r) return;
                if (r.status !== 'success') { e.textContent = (r.problems && r.problems.length ? '發布前請先處理：' + r.problems.slice(0, 5).join('；') : U.errText(r)); return; }
                const g = await call({ action: 'quiz_get', quiz_id: B.quizId }); if (g && g.status === 'success') { S.B = fromQuiz(g); }
                say('已發布並指派給 ' + ids.length + ' 個班級。學生會在「老師任務」看到。'); show('list');
            } finally { b.disabled = false; }
        }, 'ds-btn ds-btn--gold ds-btn--sm', 'tq-publish-go');
        box.appendChild(b);
    }
    async function archiveQuiz(id, fromBuilder) {
        const ok = await U.modal({ title: '要封存這份測驗嗎？', lines: ['封存後不會出現在清單，已收到的作答紀錄仍會保留。'], ok: '封存', focusCancel: true }); if (!ok) return;
        const r = await call({ action: 'quiz_archive', quiz_id: id }); if (!r || r.status !== 'success') { say(r ? U.errText(r) : '', true); return; }
        if (fromBuilder) S.B = null; say('已封存。'); show('list');
    }

    /* ---------- 我出的任務或測驗 ---------- */
    async function viewList() {
        $('tq-h').textContent = '我出的任務或測驗'; const m = main(); m.appendChild(U.lifeRing());
        const r = await call({ action: 'quiz_list' }); if (!r || S.view !== 'list') return; U.clear(m);
        if (r.status !== 'success') { m.appendChild(U.stateBox('error', U.errText(r), function () { show('list'); })); return; }
        const act = U.el('div', 'qz-actions'); act.appendChild(U.btn('建立新測驗', openNew, 'ds-btn ds-btn--gold ds-btn--sm', 'tq-new')); m.appendChild(act);
        if (!r.quizzes.length) { m.appendChild(U.stateBox('empty', '還沒有測驗。按「建立新測驗」開始出題。')); return; }
        const grid = U.el('div', 'qz-cards'); grid.id = 'tq-quiz-list';
        r.quizzes.forEach(function (q) {
            const c = U.el('article', 'qz-card'); c.setAttribute('data-quiz', q.quiz_id);
            c.appendChild(U.el('h3', 'qz-card__h', q.title));
            c.appendChild(U.el('p', 'qz-card__l', (q.status === 'draft' ? '草稿' : (q.status === 'published' ? '已發布' : '已封存')) + '　第 ' + q.version + ' 版　' + q.item_count + ' 題　' + (r.modes[q.feedback_mode] || '') + '　更新 ' + U.when(q.updated_at)));
            (q.assignments || []).forEach(function (a) {
                const row = U.el('div', 'qz-asg'); row.appendChild(U.el('span', null, a.class_name + '　' + (a.status === 'open' ? '進行中' : '已關閉') + (a.due_date ? '　截止 ' + a.due_date : '') + (a.results_released_at ? '　已公布結果' : '')));
                row.appendChild(U.btn('看作答結果', function () { show('assignment', a); }, 'btn-view qz-mini', 'tq-res-' + a.assignment_id)); c.appendChild(row);
            });
            const bt = U.el('div', 'qz-actions');
            if (q.status === 'draft') bt.appendChild(U.btn('編輯', async function () { const g = await call({ action: 'quiz_get', quiz_id: q.quiz_id }); if (!g || g.status !== 'success') { say(g ? U.errText(g) : '', true); return; } S.B = fromQuiz(g); show('builder'); }, 'btn-view', 'tq-edit-' + q.quiz_id));
            if (q.status === 'published') {
                bt.appendChild(U.btn('指派給其他班級', async function () { const g = await call({ action: 'quiz_get', quiz_id: q.quiz_id }); if (!g || g.status !== 'success') { say(g ? U.errText(g) : '', true); return; } S.B = fromQuiz(g); show('builder'); }, 'btn-view', 'tq-assign-' + q.quiz_id));
                bt.appendChild(U.btn('建立新版本', async function () { const g = await call({ action: 'quiz_clone', quiz_id: q.quiz_id }); if (!g || g.status !== 'success') { say(g ? U.errText(g) : '', true); return; } S.B = fromQuiz(g); show('builder'); say('已建立新版本草稿。'); }, 'btn-view', 'tq-clone-' + q.quiz_id));
            }
            if (q.status !== 'archived') bt.appendChild(U.btn('封存', function () { archiveQuiz(q.quiz_id, false); }, 'btn-view qz-danger', 'tq-arch-' + q.quiz_id));
            c.appendChild(bt); grid.appendChild(c);
        });
        m.appendChild(grid);
    }

    /* ---------- 學生作答結果：先選班級／測驗 ---------- */
    async function viewResults() {
        $('tq-h').textContent = '學生作答結果'; const m = main(); m.appendChild(U.lifeRing());
        const lc = await loadClasses(); if (S.view !== 'results') return; U.clear(m);
        if (lc.err) { m.appendChild(U.stateBox('error', lc.err, function () { show('results'); })); return; }
        if (!lc.classes.length) { m.appendChild(U.stateBox('empty', '你還沒有班級。')); return; }
        lc.classes.forEach(function (c) {
            const sec = U.el('section', 'qz-sec'); sec.appendChild(U.el('h3', 'qz-h', c.class_name)); const box = U.el('div'); box.id = 'tq-rc-' + c.class_id; sec.appendChild(box); m.appendChild(sec);
            call({ action: 'quiz_class_list', class_id: c.class_id }).then(function (r) {
                if (!r || S.view !== 'results') return; U.clear(box);
                if (r.status !== 'success') { box.appendChild(U.stateBox('error', U.errText(r))); return; }
                if (!r.assignments.length) { box.appendChild(U.el('p', 'qz-muted', '這個班還沒有測驗。')); return; }
                r.assignments.forEach(function (a) {
                    const row = U.el('div', 'qz-asg'); row.appendChild(U.el('span', null, a.title + '　已送出 ' + a.submitted_count + '／' + a.roster_count + '　' + (a.status === 'open' ? '進行中' : '已關閉') + (a.results_released_at ? '　已公布' : '')));
                    row.appendChild(U.btn('查看', function () { show('assignment', a); }, 'btn-view qz-mini', 'tq-open-' + a.assignment_id)); box.appendChild(row);
                });
            });
        });
    }
    function viewClassResults() { viewResults(); }

    /* ---------- 單一指派的結果 ---------- */
    async function viewAssignment(a) {
        S.cur = a; $('tq-h').textContent = '測驗結果'; const m = main(); m.appendChild(U.lifeRing());
        const r = await call({ action: 'quiz_results', assignment_id: a.assignment_id }); if (!r || S.view !== 'assignment') return; U.clear(m);
        if (r.status !== 'success') { m.appendChild(U.stateBox('error', U.errText(r), function () { show('assignment', a); })); return; }
        const asg = r.assignment, sm = r.summary;
        const head = U.el('section', 'qz-sec'); head.appendChild(U.el('h2', 'qz-h', r.quiz.title + '（' + asg.class_name + '）'));
        head.appendChild(U.el('p', 'qz-card__l', r.mode_label + '　' + (asg.status === 'open' ? '進行中' : '已關閉') + (asg.due_date ? '　截止 ' + asg.due_date : '') + (asg.results_released_at ? '　已於 ' + U.when(asg.results_released_at) + ' 公布結果' : '　尚未公布結果')));
        const nums = U.el('div', 'qz-metrics'); nums.id = 'tq-summary';
        [['全班人數', sm.roster], ['已送出', sm.submitted], ['作答中', sm.in_progress], ['未開始', sm.not_started], ['待老師檢視（題）', sm.pending_review]].forEach(function (x) { const d = U.el('div', 'qz-metric'); d.appendChild(U.el('b', null, x[1])); d.appendChild(U.el('span', null, x[0])); nums.appendChild(d); });
        head.appendChild(nums); head.appendChild(U.el('p', 'qz-muted', r.note));
        const acts = U.el('div', 'qz-actions');
        if (r.quiz.feedback_mode !== 'practice' && !asg.results_released_at) acts.appendChild(U.btn('公布結果…', function () { release(a, r); }, 'ds-btn ds-btn--gold ds-btn--sm', 'tq-release'));
        if (asg.status === 'open') acts.appendChild(U.btn('關閉這次指派', async function () { if (!(await U.modal({ title: '關閉這次指派？', lines: ['關閉後學生不能再開始或送出；已送出的作答仍保留。'], ok: '關閉', focusCancel: true }))) return; const c = await call({ action: 'quiz_close_assignment', assignment_id: a.assignment_id }); if (!c || c.status !== 'success') { say(c ? U.errText(c) : '', true); return; } say('已關閉。'); show('assignment', a); }, 'btn-view', 'tq-close-asg'));
        [['class', '匯出全班結果'], ['items', '匯出每題統計'], ['unsubmitted', '匯出未繳交名單']].forEach(function (x) { acts.appendChild(exportBtn(x[1], { action: 'quiz_export', assignment_id: a.assignment_id, kind: x[0] }, 'quiz-' + x[0], 'tq-export-' + x[0])); });
        head.appendChild(acts); const em = U.el('p', 'qz-muted', ''); em.id = 'tq-export-msg'; em.setAttribute('role', 'status'); head.appendChild(em); m.appendChild(head);
        const ss = U.el('section', 'qz-sec'); ss.appendChild(U.el('h3', 'qz-h', '學生')); const grid = U.el('div', 'qz-cards'); grid.id = 'tq-students';
        const SL = { submitted: '已送出', in_progress: '作答中（尚未送出）', not_started: '未開始' };
        r.students.forEach(function (s) {
            const c = U.el('article', 'qz-card'); c.setAttribute('data-member', s.member_id);
            c.appendChild(U.el('h4', 'qz-card__h', s.nickname + (s.left ? '（已離班）' : '')));
            c.appendChild(U.el('p', 'qz-card__l', (SL[s.state] || s.state) + '　送出 ' + s.attempts_used + ' 次' + (s.submitted_at ? '　最後送出 ' + U.when(s.submitted_at) : '')));
            if (s.real_name) c.appendChild(U.el('p', 'qz-card__l', '登記姓名：' + s.real_name));
            if (s.score !== null && s.score !== undefined) c.appendChild(U.el('p', 'qz-card__l', '最高分：' + s.score + '／' + s.max + (s.provisional ? '（暫計，還有 ' + s.pending_count + ' 題待檢視）' : '')));
            if (s.attempts_used > 0) c.appendChild(U.btn('查看作答與批改', function () { show('attempt', { a: a, member: s }); }, 'btn-view qz-mini', 'tq-view-' + s.member_id));
            grid.appendChild(c);
        });
        if (!r.students.length) grid.appendChild(U.stateBox('empty', '這個班級目前沒有學生。'));
        ss.appendChild(grid); m.appendChild(ss);
        const is = U.el('section', 'qz-sec'); is.appendChild(U.el('h3', 'qz-h', '每題統計')); const ig = U.el('div', 'qz-cards'); ig.id = 'tq-itemstats';
        r.items.forEach(function (x) {
            const c = U.el('article', 'qz-card'); c.appendChild(U.el('h4', 'qz-card__h', '第 ' + x.position + ' 題　' + x.content));
            c.appendChild(U.el('p', 'qz-card__l', '作答 ' + x.answered + ' 人　' + (x.correct_rate === null ? '答對率：—（不自動批改）' : '答對率 ' + x.correct_rate + '%（對 ' + x.right + '／錯 ' + x.wrong + '）') + (x.pending_review ? '　待檢視 ' + x.pending_review + ' 人' : '')));
            if (x.common_wrong && x.common_wrong.length) c.appendChild(U.el('p', 'qz-card__l', '常見錯誤答案：' + x.common_wrong.map(function (w) { return w.text + '（' + w.n + '）'; }).join('、')));
            ig.appendChild(c);
        });
        is.appendChild(ig); m.appendChild(is);
        const back = U.el('div', 'qz-actions'); back.appendChild(U.btn('回結果清單', function () { show('results'); }, 'btn-view', 'tq-back-results')); m.appendChild(back);
    }
    async function release(a, r) {
        const ok = await U.modal({ title: '要公布結果嗎？', lines: ['公布後，學生按「查看結果」會看到：'], list: ['每一題的對錯與得分', '正確答案與解析（沒有設定答案的題目不會顯示正解）', '你給的評語', '分數；尚未批改的題目會標示「等老師檢視」，總分是暫計'], ok: '公布結果', cancel: '先不要', focusCancel: true });
        if (!ok) return;
        const x = await call({ action: 'quiz_release_results', assignment_id: a.assignment_id, confirm: true }); if (!x || x.status !== 'success') { say(x ? U.errText(x) : '', true); return; }
        say('已公布結果。'); show('assignment', a);
    }
    function exportBtn(text, payload, base, id) {
        return U.btn(text, async function () {
            const msg = $('tq-export-msg'); if (msg) msg.textContent = '匯出中…';
            const r = await call(payload); if (!r) return;
            if (r.status !== 'success') { if (msg) msg.textContent = '匯出失敗：' + U.errText(r); return; }
            CsvExport.download(CsvExport.fname(base), CsvExport.build(r.meta, r.columns, r.rows)); if (msg) msg.textContent = '已匯出，共 ' + r.rows.length + ' 筆。檔案內含學生資料，請妥善保管。';
        }, 'btn-view', id);
    }

    /* ---------- 個別學生作答與手動批改 ---------- */
    async function viewAttempt(arg) {
        const a = arg.a; $('tq-h').textContent = '作答與批改'; const m = main(); m.appendChild(U.lifeRing());
        const r = await call({ action: 'quiz_attempt_detail', assignment_id: a.assignment_id, member_id: arg.member.member_id }); if (!r || S.view !== 'attempt') return; U.clear(m);
        if (r.status !== 'success') { m.appendChild(U.stateBox('error', U.errText(r), function () { show('attempt', arg); })); return; }
        const head = U.el('section', 'qz-sec'); head.appendChild(U.el('h2', 'qz-h', r.nickname + (r.left ? '（已離班）' : '') + '　' + r.quiz.title));
        const acts = U.el('div', 'qz-actions'); acts.appendChild(exportBtn('匯出這位學生的作答', { action: 'quiz_export', assignment_id: a.assignment_id, kind: 'student', member_id: arg.member.member_id }, 'quiz-student', 'tq-export-student'));
        acts.appendChild(U.btn('回測驗結果', function () { show('assignment', a); }, 'btn-view', 'tq-back-asg')); head.appendChild(acts);
        const em = U.el('p', 'qz-muted', ''); em.id = 'tq-export-msg'; em.setAttribute('role', 'status'); head.appendChild(em); m.appendChild(head);
        const canMark = !r.left && r.assignment.class_status !== 'archived';
        r.attempts.forEach(function (at) {
            const sec = U.el('section', 'qz-sec'); sec.setAttribute('data-attempt', at.attempt_id);
            sec.appendChild(U.el('h3', 'qz-h', '第 ' + at.attempt_no + ' 次作答　' + (at.status === 'submitted' ? '已送出 ' + U.when(at.submitted_at) : '作答中')));
            if (at.status === 'submitted') sec.appendChild(U.el('p', 'qz-card__l', '得分：' + at.score + '／' + at.max + (at.provisional ? '（暫計：還有 ' + at.pending_count + ' 題待老師檢視，尚未完成批改）' : '')));
            const ST = { correct: '答對', wrong: '答錯', unanswered: '未作答', pending: '待老師檢視', reviewed: '已檢視', reviewed_unscored: '已檢視（未評分）' };
            at.items.forEach(function (x) {
                const c = U.el('article', 'qz-ritem qz-ritem--' + x.state); c.setAttribute('data-item', x.item_id);
                c.appendChild(U.el('h4', 'qz-card__h', '第 ' + x.position + ' 題　' + (ST[x.state] || x.state)));
                c.appendChild(U.el('p', 'qz-card__l', x.content));
                c.appendChild(U.el('p', 'qz-card__l', '學生答案：' + (x.answer === '' || x.answer === undefined ? '（沒有作答）' : x.answer) + (x.correct_answer ? '　正確答案：' + x.correct_answer : '')));
                if (x.earned !== null && x.earned !== undefined) c.appendChild(U.el('p', 'qz-card__l', '得分 ' + x.earned + '／' + x.max));
                if (at.status === 'submitted' && x.gradable !== 'auto' && canMark) c.appendChild(markForm(a, at, x, arg));
                else if (x.comment) c.appendChild(U.el('p', 'qz-card__l', '評語：' + x.comment));
                sec.appendChild(c);
            });
            m.appendChild(sec);
        });
    }
    function markForm(a, at, x, arg) {
        const f = U.el('div', 'qz-mark'); f.appendChild(U.el('p', 'qz-muted', '這題不自動批改。檢視後可以（選填）給分數與評語；沒批改前不會算 0 分。'));
        const sc = input('tq-ms-' + x.item_id, x.reviewed_score === null || x.reviewed_score === undefined ? '' : x.reviewed_score, '0～' + x.max + ' 分（選填）', 5);
        const cm = input('tq-mc-' + x.item_id, x.comment || '', '評語（選填）', 200);
        const row = U.el('div', 'qz-row'); row.appendChild(field('分數（0～' + x.max + '）', sc)); row.appendChild(field('評語', cm, 'qz-grow')); f.appendChild(row);
        const e = U.el('p', 'ds-error en-error', ''); e.setAttribute('role', 'alert'); f.appendChild(e);
        const go = async function (reviewed) {
            e.textContent = ''; const p = { action: 'quiz_mark_item', assignment_id: a.assignment_id, attempt_id: at.attempt_id, item_id: x.item_id, comment: cm.value };
            if (reviewed) { p.score = sc.value.trim(); } else p.reviewed = false;
            const r = await call(p); if (!r) return; if (r.status !== 'success') { e.textContent = U.errText(r); return; } say(reviewed ? '已標記為已檢視。' : '已取消檢視標記。'); show('attempt', arg);
        };
        const row2 = U.el('div', 'qz-actions'); row2.appendChild(U.btn(x.state === 'pending' ? '標記已檢視' : '更新批改', function () { go(true); }, 'btn-view', 'tq-mark-' + x.item_id));
        if (x.state === 'reviewed' || x.state === 'reviewed_unscored') row2.appendChild(U.btn('取消已檢視', function () { go(false); }, 'btn-view', 'tq-unmark-' + x.item_id));
        f.appendChild(row2); return f;
    }

    /* ---------- 題庫 ---------- */
    function toBank(i) {
        const it = S.B.items[i]; if (!String(it.content).trim()) { say('請先輸入題目內容再存到題庫。', true); return; }
        call(Object.assign({ action: 'bank_save' }, itemPayload(it), { item_id: undefined })).then(function (r) { if (!r) return; if (r.status !== 'success') { say(U.errText(r), true); return; } say('已存到我的題庫。'); });
    }
    async function bankPicker() {
        const box = U.el('div', 'qz-picker'); box.id = 'tq-picker'; const old = $('tq-picker'); if (old && old.parentNode) old.parentNode.removeChild(old);
        const host = $('tq-items').parentNode; host.insertBefore(box, $('tq-items'));
        box.appendChild(U.lifeRing('讀取題庫…')); const r = await call({ action: 'bank_list', page: 1 }); U.clear(box);
        box.appendChild(U.el('h3', 'qz-h', '從我的題庫選題（最近 20 題）'));
        if (!r || r.status !== 'success') { box.appendChild(U.stateBox('error', r ? U.errText(r) : '')); return; }
        if (!r.questions.length) box.appendChild(U.el('p', 'qz-muted', '題庫是空的。'));
        r.questions.forEach(function (q) {
            const row = U.el('div', 'qz-asg'); row.appendChild(U.el('span', null, q.content)); row.appendChild(U.btn('加入', function () { S.B.items.push(fromBank(q)); dirty(); renderItems(); say('已加入 1 題。'); }, 'btn-view qz-mini', 'tq-pick-' + q.question_id)); box.appendChild(row);
        });
        box.appendChild(U.btn('關閉', function () { box.remove(); }, 'btn-view qz-mini', 'tq-picker-close'));
    }
    function fromBank(q) {
        return newItem({ content: q.content, correct_answer: q.correct_answer, qtype: q.qtype, options: (q.options || []).map(function (o) { return o.text; }), points: q.points === 1 ? '' : String(q.points), explanation: q.explanation, context: q.context, op: q.op, difficulty: q.difficulty, tags: q.tags || [], gen_meta: q.gen_meta, source: 'bank', bank_question_id: q.question_id });
    }
    async function viewBank() {
        $('tq-h').textContent = '我的題庫'; const m = main();
        m.appendChild(U.el('p', 'qz-muted', '題庫只有你自己看得到、也只有你能修改。'));
        const f = S.bank.filters;
        const bar = U.el('form', 'ac-bar qz-bar'); bar.setAttribute('role', 'search');
        const q = input('tq-b-q', f.search || '', '題目內容關鍵字', 40, 'search'); bar.appendChild(field('搜尋', q, 'ac-bar__q'));
        bar.appendChild(field('運算', sel('tq-b-op', [['', '全部'], ['+', '加法'], ['-', '減法'], ['*', '乘法'], ['/', '除法'], ['wp', '應用題'], ['mixed', '混合']], f.op || '')));
        bar.appendChild(field('難度', sel('tq-b-diff', [['', '全部'], ['1', '基礎'], ['2', '進階'], ['3', '挑戰']], f.difficulty || '')));
        bar.appendChild(field('標籤', input('tq-b-tag', f.tag || '', '', 12)));
        const go = U.el('button', 'ds-btn ds-btn--deep ds-btn--sm', '搜尋'); go.type = 'submit'; go.id = 'tq-b-go'; bar.appendChild(go);
        bar.appendChild(U.btn('清除搜尋', function () { S.bank.filters = {}; S.bank.page = 1; show('bank'); }, 'btn-view td-clear', 'tq-b-clear'));
        bar.addEventListener('submit', function (e) { e.preventDefault(); S.bank.filters = { search: $('tq-b-q').value.trim(), op: $('tq-b-op').value, difficulty: $('tq-b-diff').value, tag: $('tq-b-tag').value.trim() }; S.bank.page = 1; load(); });
        m.appendChild(bar);
        const list = U.el('div', 'qz-cards'); list.id = 'tq-bank-list'; const pg = U.el('div'); pg.id = 'tq-bank-pager'; m.appendChild(list); m.appendChild(pg);
        async function load() {
            U.clear(list); U.clear(pg); list.appendChild(U.lifeRing());
            const r = await call(Object.assign({ action: 'bank_list', page: S.bank.page }, S.bank.filters)); if (S.view !== 'bank') return; U.clear(list);
            if (!r || r.status !== 'success') { list.appendChild(U.stateBox('error', r ? U.errText(r) : '', load)); return; }
            if (!r.questions.length) { list.appendChild(U.stateBox('empty', S.bank.filters.search || S.bank.filters.op || S.bank.filters.difficulty || S.bank.filters.tag ? '找不到符合條件的題目。' : '題庫還沒有題目。出題時按「存到題庫」就會出現在這裡。')); return; }
            r.questions.forEach(function (x) {
                const c = U.el('article', 'qz-card'); c.setAttribute('data-question', x.question_id);
                c.appendChild(U.el('h4', 'qz-card__h', x.content));
                c.appendChild(U.el('p', 'qz-card__l', (OP_TXT[x.op] || '') + '　' + (DIFF_TXT[x.difficulty] || '') + '　' + (x.gradable === 'auto' ? '自動批改' : '待老師檢視') + (x.tags.length ? '　標籤：' + x.tags.join('、') : '')));
                const bt = U.el('div', 'qz-actions');
                bt.appendChild(U.btn('用這題建立新測驗', function () { S.B = newDraft(); S.B.items.push(fromBank(x)); S.B.dirty = true; show('builder'); }, 'btn-view qz-mini', 'tq-b-use-' + x.question_id));
                bt.appendChild(U.btn('複製', async function () { const k = await call({ action: 'bank_copy', question_id: x.question_id }); if (!k || k.status !== 'success') { say(k ? U.errText(k) : '', true); return; } say('已複製一份到題庫。'); load(); }, 'btn-view qz-mini', 'tq-b-copy-' + x.question_id));
                bt.appendChild(U.btn('封存', async function () { if (!(await U.modal({ title: '要把這題從題庫移除嗎？', lines: ['已經用在測驗裡的題目不受影響。'], ok: '移除', focusCancel: true }))) return; const k = await call({ action: 'bank_archive', question_id: x.question_id }); if (!k || k.status !== 'success') { say(k ? U.errText(k) : '', true); return; } load(); }, 'btn-view qz-mini qz-danger', 'tq-b-arch-' + x.question_id));
                c.appendChild(bt); list.appendChild(c);
            });
            const info = U.el('p', 'qz-muted', '第 ' + r.page + '／' + r.total_pages + ' 頁　共 ' + r.total + ' 題'); info.id = 'tq-bank-info'; pg.appendChild(info);
            const row = U.el('div', 'qz-actions'); const pv = U.btn('上一頁', function () { S.bank.page = r.page - 1; load(); }, 'btn-view', 'tq-b-prev'); pv.disabled = r.page <= 1; const nx = U.btn('下一頁', function () { S.bank.page = r.page + 1; load(); }, 'btn-view', 'tq-b-next'); nx.disabled = r.page >= r.total_pages; row.appendChild(pv); row.appendChild(nx); pg.appendChild(row);
        }
        load();
    }

    function reset() { S.view = ''; S.B = null; S.classes = null; S.avail = null; S.busy = false; S.saving = false; S.cur = null; S.bank = { page: 1, filters: {} }; U.closeAllModals(); const m = $('tq-main'); if (m) m.textContent = ''; const b = $('th-quiz'); if (b) b.hidden = true; }
    return { onHome: onHome, open: open, openNew: openNew, openBank: openBank, openResults: openResults, reset: reset, show: show, _state: S };
})();
