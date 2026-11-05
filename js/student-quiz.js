/* 階段 10：學生「老師測驗」
   * 入口就在「我的班級 → 老師任務」同一個畫面裡（不另外做第二個入口）。
   * 作答：上一題／下一題、題號列（有作答會標示）、自動暫存（節流，不是每打一個字就送出）、送出前有確認視窗、不會重複送出。
   * 按 Enter 只會結束輸入，不會送出整份測驗。
   * 考試模式不會顯示正確答案；老師公布前只顯示「已送出」。測驗不會增加星星、不會改變燈塔。
   * 暫存的答案只保存在後端；這裡不使用瀏覽器儲存空間。後端傳來的文字一律用 textContent 寫入。 */
const StudentQuiz = (function () {
    const U = QZU, $ = function (id) { return document.getElementById(id); };
    const st = { avail: false, probed: false, list: null, err: '', busy: false, run: null };
    const SAVE_FLOOR_MS = 3000;

    function call(payload) {
        return U.withTimeout(apiCall(payload)).then(function (r) {
            if (r && r.code === 'SESSION_INVALID' && typeof AuthSession !== 'undefined' && AuthSession.student && typeof SessionGuard !== 'undefined') { SessionGuard.studentExpired(); return null; }
            return r || { status: 'error', message: '沒有收到回應' };
        });
    }
    /* 給玩法指南用：只讀快取，不呼叫後端 */
    function available() { return st.avail === true; }
    async function probe() {
        if (st.probed) return st.avail; st.probed = true;
        try { const r = await call({ action: 'list_student_quizzes' }); if (r && r.status === 'success') { st.avail = r.enabled === true; st.list = r; } else st.probed = false; }
        catch (e) { st.probed = false; }
        return st.avail;
    }

    /* ---------- 清單（放在「老師任務」畫面裡） ---------- */
    const STATE_LABEL = { not_started: '還沒開始', in_progress: '作答中（尚未送出）', submitted: '已送出' };
    function card(q) {
        const c = U.el('article', 'sq-card sq-' + q.state); c.setAttribute('data-assignment', q.assignment_id);
        const head = U.el('div', 'stt-head'); head.appendChild(U.el('h3', 'stt-title', q.title));
        head.appendChild(U.el('span', 'ds-chip stt-chip ' + (q.state === 'submitted' ? 'ds-chip--success' : 'ds-chip--info'), STATE_LABEL[q.state] || q.state)); c.appendChild(head);
        c.appendChild(U.el('p', 'stt-meta', q.teacher_name + ' 老師　' + q.mode_label + '　共 ' + q.item_count + ' 題'));
        c.appendChild(U.el('p', 'stt-meta', (q.due_date ? '截止日：' + q.due_date + '（含當天）' : '沒有截止日') + '　作答次數：' + q.attempts_used + '／' + q.attempts_allowed));
        if (q.description) c.appendChild(U.el('p', 'stt-desc', q.description));
        if (q.state === 'submitted') {
            if (q.score !== undefined) c.appendChild(U.el('p', 'sq-score', '我的分數：' + q.score + '／' + q.max + (q.provisional ? '（暫計，尚未完成批改）' : '')));
            if (q.score_note) c.appendChild(U.el('p', 'stt-meta', q.score_note));
            if (q.message) c.appendChild(U.el('p', 'stt-meta', q.message));
        }
        if (!q.open_now && q.window_note && q.state !== 'submitted') c.appendChild(U.el('p', 'stt-meta', q.window_note));
        const act = U.el('div', 'sq-act');
        if (q.can_continue) act.appendChild(U.btn('繼續作答', function () { start(q, this); }, 'ds-btn ds-btn--sea ds-btn--sm', 'sq-continue-' + q.assignment_id));
        else if (q.can_start) act.appendChild(U.btn(q.state === 'submitted' ? '再作答一次' : '開始作答', function () { start(q, this); }, 'ds-btn ds-btn--sea ds-btn--sm', 'sq-start-' + q.assignment_id));
        if (q.state === 'submitted' && q.result_level !== 'none') act.appendChild(U.btn('查看結果', function () { showResultFor(q); }, 'ds-btn ds-btn--gold ds-btn--sm', 'sq-result-' + q.assignment_id));
        if (act.children.length) c.appendChild(act);
        return c;
    }
    function renderList(host) {
        if (!host) return; U.clear(host);
        if (!st.list) { if (st.err) host.appendChild(U.el('p', 'tp-hint', st.err)); return; }
        if (st.list.enabled === false) return;
        const qs = st.list.quizzes || [];
        const sec = U.el('section', 'stt-sec sq-sec'); sec.setAttribute('aria-labelledby', 'sq-h');
        const h = U.el('h2', 'tp-hello', '老師測驗（' + qs.length + '）'); h.id = 'sq-h'; sec.appendChild(h);
        sec.appendChild(U.el('p', 'tp-note', '測驗不會增加星星，也不會改變燈塔。暫存只是存起來，按「送出測驗」才算交卷。'));
        if (!qs.length) sec.appendChild(U.el('p', 'tp-hint', '目前沒有老師測驗。'));
        qs.forEach(function (q) { sec.appendChild(card(q)); });
        host.appendChild(sec);
    }
    async function loadInto(host) {
        if (st.busy) return; st.busy = true;
        try {
            const r = await call({ action: 'list_student_quizzes' });
            if (r && r.status === 'success') { st.list = r; st.avail = r.enabled === true; st.probed = true; st.err = ''; }
            else if (r) st.err = '現在讀不到老師測驗（' + (r.message || '連線失敗') + '）。這不代表沒有測驗，請稍後再按「重新整理」。';
        } finally { st.busy = false; }
        renderList(host);
    }

    /* ---------- 作答畫面 ---------- */
    function ensureRunScreen() {
        if ($('screen-sq-run')) return;
        const s = U.el('div', 'screen en-screen sq-screen'); s.id = 'screen-sq-run';
        const wrap = U.el('div', 'en-wrap en-wrap--card'); const card = U.el('div', 'ds-card ds-card--canvas en-card sp-card sq-runcard'); wrap.appendChild(card); s.appendChild(wrap);
        card.appendChild(U.el('h1', 'ds-plank en-card__title', '老師測驗')).id = 'sq-title';
        const meta = U.el('p', 'tp-hint', ''); meta.id = 'sq-meta'; card.appendChild(meta);
        const nav = U.el('nav', 'sq-dots'); nav.id = 'sq-dots'; nav.setAttribute('aria-label', '題號'); card.appendChild(nav);
        const prog = U.el('p', 'sq-prog', ''); prog.id = 'sq-prog'; prog.setAttribute('role', 'status'); card.appendChild(prog);
        const q = U.el('div', 'sq-q'); q.id = 'sq-q'; card.appendChild(q);
        const save = U.el('p', 'sq-save', ''); save.id = 'sq-save'; save.setAttribute('role', 'status'); save.setAttribute('aria-live', 'polite'); card.appendChild(save);
        const err = U.el('p', 'ds-error en-error', ''); err.id = 'sq-err'; err.setAttribute('role', 'alert'); card.appendChild(err);
        const row = U.el('div', 'sq-nav');
        row.appendChild(U.btn('上一題', function () { go(-1); }, 'ds-btn ds-btn--ghost ds-btn--sm', 'sq-prev'));
        row.appendChild(U.btn('下一題', function () { go(1); }, 'ds-btn ds-btn--sea ds-btn--sm', 'sq-next'));
        card.appendChild(row);
        card.appendChild(U.btn('送出測驗', submit, 'ds-btn ds-btn--gold ds-btn--block', 'sq-submit'));
        card.appendChild(U.btn('先離開（答案已暫存）', leave, 'ds-btn ds-btn--ghost ds-btn--block en-back', 'sq-leave'));
        document.body.appendChild(s);
    }
    function answeredCount() { return st.run.items.filter(function (it) { return String(st.run.answers[it.item_id] || '').trim() !== ''; }).length; }
    function setSave(t) { const e = $('sq-save'); if (e) e.textContent = t || ''; }
    function renderDots() {
        const nav = U.clear($('sq-dots'));
        st.run.items.forEach(function (it, i) {
            const done = String(st.run.answers[it.item_id] || '').trim() !== '';
            const b = U.btn(String(i + 1), function () { goto(i); }, 'sq-dot' + (done ? ' is-done' : '') + (i === st.run.idx ? ' is-cur' : ''), 'sq-dot-' + (i + 1));
            b.setAttribute('aria-label', '第 ' + (i + 1) + ' 題' + (done ? '，已作答' : '，還沒作答')); if (i === st.run.idx) b.setAttribute('aria-current', 'step'); nav.appendChild(b);
        });
    }
    function renderQ() {
        const r = st.run, it = r.items[r.idx], box = U.clear($('sq-q'));
        $('sq-prog').textContent = '第 ' + (r.idx + 1) + '／' + r.items.length + ' 題　已作答 ' + answeredCount() + ' 題';
        if (it.context) { const cx = U.el('p', 'sq-context', it.context); cx.id = 'sq-context'; box.appendChild(cx); }
        const qt = U.el('p', 'sq-content', it.content); qt.id = 'sq-content'; box.appendChild(qt);
        const val = String(r.answers[it.item_id] === undefined ? '' : r.answers[it.item_id]);
        const set = function (v) { r.answers[it.item_id] = v; r.dirty = true; renderDots(); $('sq-prog').textContent = '第 ' + (r.idx + 1) + '／' + r.items.length + ' 題　已作答 ' + answeredCount() + ' 題'; schedule(); };
        const noEnter = function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } }); };
        if (it.qtype === 'choice') {
            const g = U.el('div', 'sq-opts'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', '選項');
            (it.options || []).forEach(function (o) {
                const lab = U.el('label', 'tp-radio sq-opt'); const inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'sq-choice'; inp.value = o.id; inp.checked = val === o.id;
                inp.addEventListener('change', function () { set(o.id); }); lab.appendChild(inp); lab.appendChild(U.el('span', null, o.id + '. ' + o.text)); g.appendChild(lab);
            });
            box.appendChild(g);
        } else if (it.qtype === 'remainder') {
            const parts = val.split('|'); const wrap = U.el('div', 'sq-rem');
            const mk = function (label, idx, id) {
                const l = U.el('label', 'sq-rem__f'); l.appendChild(U.el('span', null, label)); const inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.id = id; inp.autocomplete = 'off'; inp.maxLength = 8; inp.value = parts[idx] || '';
                noEnter(inp); inp.addEventListener('input', function () { const q = $('sq-rem-q').value.trim(), m = $('sq-rem-r').value.trim(); set(q === '' && m === '' ? '' : q + '|' + m); }); l.appendChild(inp); return l;
            };
            wrap.appendChild(mk('商', 0, 'sq-rem-q')); wrap.appendChild(mk('餘數', 1, 'sq-rem-r')); box.appendChild(wrap);
        } else {
            const l = U.el('label', 'sq-ans'); l.appendChild(U.el('span', null, it.qtype === 'open' ? '你的回答' : '你的答案'));
            const inp = document.createElement('input'); inp.type = 'text'; inp.id = 'sq-answer'; inp.autocomplete = 'off'; inp.autocapitalize = 'none'; inp.spellcheck = false; inp.maxLength = 100; inp.value = val;
            if (it.qtype !== 'open') inp.setAttribute('inputmode', 'text');
            noEnter(inp); inp.addEventListener('input', function () { set(inp.value); }); l.appendChild(inp); box.appendChild(l);
        }
        $('sq-prev').disabled = r.idx === 0; $('sq-next').disabled = r.idx === r.items.length - 1;
    }
    function refresh() { renderDots(); renderQ(); }
    function goto(i) { const r = st.run; if (!r) return; r.idx = Math.max(0, Math.min(r.items.length - 1, i)); if (r.dirty) flush(true); refresh(); }
    function go(d) { goto(st.run.idx + d); }

    /* 自動暫存：停止輸入一陣子才存；後端還有自己的節流，被節流就稍後再試；失敗不影響作答，送出時會帶全部答案 */
    function schedule() {
        const r = st.run; if (!r || r.submitted) return;
        if (r.timer) clearTimeout(r.timer);
        r.timer = setTimeout(function () { flush(false); }, Math.max(r.saveMs || 0, SAVE_FLOOR_MS));
        setSave('還沒暫存…');
    }
    async function flush(soon) {
        const r = st.run; if (!r || r.submitted || r.saving || !r.dirty) return 'skip';
        if (r.timer) { clearTimeout(r.timer); r.timer = 0; }
        r.saving = true; const snap = JSON.stringify(r.answers); setSave('暫存中…');
        let outcome = 'fail';
        try {
            const res = await call({ action: 'quiz_save_draft', attempt_id: r.attemptId, answers: r.answers });
            if (!st.run || st.run !== r) return 'skip';
            if (res && res.status === 'success') {
                if (res.already_submitted) { r.submitted = true; setSave('這份測驗已經在另一個畫面送出了。'); lockInputs(); return 'done'; }
                if (res.throttled) { outcome = 'throttled'; r.timer = setTimeout(function () { flush(false); }, Math.max(r.saveMs || 0, SAVE_FLOOR_MS)); setSave('稍後會自動暫存'); }
                else { outcome = 'ok'; if (JSON.stringify(r.answers) === snap) r.dirty = false; else schedule(); setSave('已暫存（只是存起來，還沒有送出）'); }
            } else if (res) {
                setSave('這次沒有暫存成功（' + (res.message || '連線問題') + '）。你可以繼續作答，稍後會再試；按「送出測驗」時會一起送出。');
                r.timer = setTimeout(function () { flush(false); }, 15000);
            }
        } finally { if (st.run === r) r.saving = false; }
        void soon; return outcome;
    }
    function lockInputs() { document.querySelectorAll('#sq-q input').forEach(function (i) { i.disabled = true; }); const s = $('sq-submit'); if (s) s.disabled = true; }

    async function start(q, b) {
        if (b) b.disabled = true;
        try {
            const r = await call({ action: 'quiz_start', assignment_id: q.assignment_id });
            if (!r) return;
            if (r.status !== 'success') { const m = $('stt-msg'); if (m) m.textContent = r.message || '現在不能開始作答。'; return; }
            openRun(r.attempt);
        } finally { if (b) b.disabled = false; }
    }
    function openRun(a) {
        ensureRunScreen();
        st.run = { attemptId: a.attempt_id, assignmentId: a.assignment_id, items: a.items, answers: Object.assign({}, a.answers || {}), idx: 0, dirty: false, saving: false, submitted: false, timer: 0, saveMs: a.save_min_ms || 2000, sending: false, title: a.title };
        $('sq-title').textContent = a.title || '老師測驗';
        $('sq-meta').textContent = (a.mode_label || '') + (a.due_date ? '　截止日：' + a.due_date + '（含當天）' : '') + '　第 ' + a.attempt_no + ' 次作答';
        $('sq-err').textContent = ''; setSave(a.saved_at ? '上次暫存：' + U.when(a.saved_at) : ''); $('sq-submit').disabled = false;
        refresh(); switchScreen('screen-sq-run');
    }
    async function leave() {
        const r = st.run;
        /* 離開前一定要把答案存到後端：正在存就等它；後端因為節流說「太快了」就等一下再存（最多 4 次），不能默默丟掉答案 */
        for (let i = 0; r && !r.submitted && st.run === r && (r.dirty || r.saving) && i < 6; i++) {
            if (r.saving) { await new Promise(function (res) { setTimeout(res, 300); }); continue; }
            const o = await flush(true);
            if (o === 'throttled') { setSave('正在把答案存起來…'); await new Promise(function (res) { setTimeout(res, Math.max(r.saveMs || 0, 2000) + 300); }); }
            else if (o === 'fail') break;
        }
        if (r && !r.submitted && r.dirty && st.run === r) { $('sq-err').textContent = '答案還沒有存到網路上，現在離開可能會遺失。確定要離開的話，請再按一次「先離開」。'; if (!r.warnedLeave) { r.warnedLeave = true; return; } }
        if (r && r.timer) clearTimeout(r.timer);
        st.run = null; if (typeof StudentTasks !== 'undefined') StudentTasks.open();
    }
    async function submit() {
        const r = st.run; if (!r || r.sending || r.submitted || r.confirming) return;
        r.confirming = true;
        const left = r.items.length - answeredCount();
        const ok = await U.modal({ title: '要送出測驗嗎？', lines: [left > 0 ? '還有 ' + left + ' 題沒有作答。' : '每一題都作答了。', '送出後就不能修改這一次的答案。'], list: ['按「送出」才算交卷。', '暫存只是先存起來，不算交卷。'], ok: '送出', cancel: '再檢查一下', focusCancel: true });
        r.confirming = false;
        if (!ok || !st.run || st.run !== r || r.sending || r.submitted) return;
        r.sending = true; $('sq-submit').disabled = true; $('sq-err').textContent = ''; setSave('送出中…');
        if (r.timer) { clearTimeout(r.timer); r.timer = 0; }
        let res = null;
        try { res = await call({ action: 'quiz_submit', attempt_id: r.attemptId, answers: r.answers, request_id: 'rq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }); }
        finally { r.sending = false; }
        if (!res) { $('sq-submit').disabled = false; return; }
        if (res.status !== 'success') {
            $('sq-err').textContent = (res.code === 'NETWORK' || res.code === 'TIMEOUT' || (!res.code && /連線/.test(res.message || '')) ? '網路好像不穩，這次沒有送出。你的答案還在畫面上，連線後再按一次「送出測驗」。' : (res.message || '送出失敗，請再試一次。'));
            setSave(''); $('sq-submit').disabled = false; return;
        }
        r.submitted = true; r.dirty = false; showResult(res.result, r.title, true);
    }

    /* ---------- 結果 ---------- */
    function ensureResultScreen() {
        if ($('screen-sq-result')) return;
        const s = U.el('div', 'screen en-screen sq-screen'); s.id = 'screen-sq-result';
        const wrap = U.el('div', 'en-wrap en-wrap--card'); const card = U.el('div', 'ds-card ds-card--canvas en-card sp-card sq-resultcard'); wrap.appendChild(card); s.appendChild(wrap);
        card.appendChild(U.el('h1', 'ds-plank en-card__title', '測驗結果')).id = 'sqr-title';
        const body = U.el('div', 'sq-rbody'); body.id = 'sqr-body'; card.appendChild(body);
        card.appendChild(U.btn('回老師任務', function () { st.run = null; if (typeof StudentTasks !== 'undefined') StudentTasks.open(); }, 'ds-btn ds-btn--sea ds-btn--block', 'sqr-back'));
        document.body.appendChild(s);
    }
    const STATE_TXT = { correct: '答對了', wrong: '答錯了', unanswered: '沒有作答', pending: '等老師檢視', reviewed: '老師已檢視', reviewed_unscored: '老師已檢視' };
    function showResult(res, title, justSubmitted) {
        ensureResultScreen(); const body = U.clear($('sqr-body')); $('sqr-title').textContent = title ? title : '測驗結果';
        if (justSubmitted) body.appendChild(U.el('p', 'sq-done', '已送出！'));
        if (res.message) body.appendChild(U.el('p', 'tp-note', res.message));
        if (res.score !== undefined) {
            body.appendChild(U.el('p', 'sq-score', '分數：' + res.score + '／' + res.max + (res.provisional ? '（暫計，尚未完成批改）' : '')));
            if (res.score_note) body.appendChild(U.el('p', 'tp-note', res.score_note));
        }
        if (res.level === 'none' && !res.message) body.appendChild(U.el('p', 'tp-note', '已送出。成績會等老師公布後再顯示。'));
        (res.items || []).forEach(function (x) {
            const c = U.el('article', 'sq-ritem sq-ritem--' + x.state);
            c.appendChild(U.el('h3', 'sq-rh', '第 ' + x.position + ' 題　' + (STATE_TXT[x.state] || x.state)));
            c.appendChild(U.el('p', 'sq-rq', x.content));
            c.appendChild(U.el('p', 'stt-meta', '你的答案：' + (x.your_answer === '' ? '（沒有作答）' : (x.qtype === 'choice' ? x.your_answer : x.your_answer))));
            if (x.correct_answer !== undefined) c.appendChild(U.el('p', 'stt-meta', '正確答案：' + x.correct_answer));
            if (x.earned !== null && x.earned !== undefined) c.appendChild(U.el('p', 'stt-meta', '得分：' + x.earned + '／' + x.max));
            if (x.comment) c.appendChild(U.el('p', 'stt-meta', '老師評語：' + x.comment));
            if (x.explanation) c.appendChild(U.el('p', 'stt-meta', '解析：' + x.explanation));
            body.appendChild(c);
        });
        switchScreen('screen-sq-result');
    }
    async function showResultFor(q) {
        const r = await call({ action: 'quiz_result', assignment_id: q.assignment_id }); if (!r) return;
        if (r.status !== 'success') { const m = $('stt-msg'); if (m) m.textContent = r.message || '現在看不到結果。'; return; }
        showResult(r.result, r.title, false);
    }
    function reset() {
        if (st.run && st.run.timer) clearTimeout(st.run.timer);
        st.avail = false; st.probed = false; st.list = null; st.err = ''; st.busy = false; st.run = null; U.closeAllModals();
        ['sq-q', 'sq-dots', 'sqr-body'].forEach(function (id) { const e = $(id); if (e) e.textContent = ''; });
        const h = $('stt-quizzes'); if (h) h.textContent = '';
    }
    /* 離開分頁或隱藏時，把還沒存的答案送一次 */
    document.addEventListener('visibilitychange', function () { if (document.hidden && st.run && st.run.dirty && !st.run.submitted) flush(true); });

    /* ---------- 玩法指南：「老師測驗」章節（沿用 Tutorial.registerChapter；只在功能可用時顯示；導覽不會送出或寫入任何資料） ---------- */
    function registerGuide() {
        if (typeof Tutorial === 'undefined' || !Tutorial.registerChapter) return;
        /* 導覽卡片的小示意（和 Tutorial 內部相同的樣式 class；只讀、不呼叫後端） */
        const esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
        const order = function (chips, steps, note) {
            return '<div class="tt-flow" aria-hidden="true">' + chips.map(function (t, i) { return (i ? '<span class="tt-flow__go">›</span>' : '') + '<span class="tt-flow__chip"><i>' + (i + 1) + '</i>' + esc(t) + '</span>'; }).join('') + '</div>' +
                '<ol class="tt-order">' + steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' + (note ? '<p class="tt-note">' + esc(note) + '</p>' : '');
        };
        const vis = function (e) { if (!e || !e.getBoundingClientRect) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const target = function () { const e = $('btn-class'); if (vis(e)) return e; const m = $('btn-more'); return vis(m) ? m : null; };
        Tutorial.registerChapter({
            id: 'quiz', order: 7, title: '老師測驗', sub: '從老師任務進入、暫存與送出、公布後看結果', icon: 'book',
            feature: { code: 'quiz', available: available },
            steps: [
                { id: 'quiz-where', title: '老師測驗在「老師任務」裡', main: '老師出的測驗，和老師任務放在同一個地方：先點「我的班級」，再按「查看老師任務」，往下就會看到「老師測驗」。',
                  more: { label: '操作順序', open: 'order', html: function () { return order(['我的班級', '查看老師任務', '老師測驗', '開始或繼續'], ['點「我的班級」。', '按「查看老師任務」。', '找到「老師測驗」區塊。', '按「開始作答」；做到一半離開的話，會看到「繼續作答」。'], '測驗不會增加星星，也不會改變燈塔。導覽不會真的開始任何測驗。'); } },
                  when: available, target: target, map: true },
                { id: 'quiz-save', title: '暫存和送出不一樣', main: '作答時，答案會自動暫存，離開再回來可以繼續。但是暫存只是先存起來，要按「送出測驗」才算交卷。',
                  more: { label: '詳細說明', open: 'order', html: function () { return '<ul class="tt-list"><li>送出前會跳出確認視窗，告訴你還有幾題沒作答。</li><li>送出之後就不能再改這一次的答案。</li><li>老師如果允許多次作答，可以再作答一次，成績以最高分為準。</li></ul>'; } },
                  when: available, target: target, map: true },
                { id: 'quiz-result', title: '送出後可能只看到「已送出」', main: '很多測驗送出後只會顯示「已送出」。等老師公布結果，你再回到老師任務按「查看結果」，就能看到對錯、分數和解析。',
                  more: { label: '詳細說明', open: 'order', html: function () { return '<ul class="tt-list"><li>考試模式不會在作答中顯示正確答案。</li><li>「待老師檢視」的題目，老師看過之後才有分數；沒批改完時，分數是暫計。</li></ul>'; } },
                  when: available, target: target, map: true }
            ]
        });
    }
    registerGuide();

    return { available: available, probe: probe, renderList: renderList, loadInto: loadInto, reset: reset, _state: st, _openRun: openRun };
})();
