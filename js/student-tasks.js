/* 階段 9D-2：學生「老師任務」清單
   * 只有加入班級（並同意分享）的學生才有任務；沒有加入班級的學生看不到任何任務，也完全不影響自己冒險。
   * 任務從不鎖住任何島嶼：每座島、每個區域都照常可以玩，任務只是「老師希望你完成的練習」。
   * 清單分成：進行中、已完成、已逾期（未完成）、已關閉（未完成）、無法判定。每個項目都有文字標籤，不只靠顏色分辨。
   * 後端沒有讀到資料時（連線失敗、功能未開）顯示「讀不到」，絕不把「讀不到」顯示成「沒有任務」或 0。
   * 後端傳來的文字一律用 textContent 寫入；這裡不保存任何資料到瀏覽器儲存空間。 */
const StudentTasks = (function () {
    const $ = function (id) { return document.getElementById(id); };
    const online = function () { return typeof GAS_URL === 'string' && GAS_URL.indexOf('http') === 0; };
    const ZONE_ZH = { LEARNING: '學習區', PRACTICE: '練習區', MASTERY: '精熟區' };
    const NOTE = '完成狀態是依你的練習紀錄整理的。任務不會鎖住任何島嶼，其他島和其他區域都可以照常玩。';
    const UNDET = '目前沒辦法確定你有沒有完成這個任務。這不代表你沒有完成，請先照常練習；如果一直這樣，請告訴老師。';
    const st = { data: null, error: '', busy: false, loadedAt: 0 };
    const DONE = { completed: 1, completed_on_time: 1, completed_late: 1, completed_existing: 1 };
    const SECTIONS = [
        { key: 'todo', title: '進行中', empty: '' },
        { key: 'done', title: '已完成', empty: '' },
        { key: 'overdue', title: '已逾期（未完成）', empty: '' },
        { key: 'closed', title: '已關閉（未完成）', empty: '' },
        { key: 'undetermined', title: '無法判定', empty: '' }
    ];

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
    function para(text, cls) { return el('p', { class: cls || 'tp-hint', text: text }); }
    function btn(label, cls, fn, id) { const b = el('button', { type: 'button', class: 'ds-btn ' + cls + ' ds-btn--block', text: label }); if (id) b.id = id; b.addEventListener('click', fn); return b; }
    function mkScreen(id, title, body) {
        if ($(id)) return $(id);
        const sea = el('div', { class: 'en-sea', 'aria-hidden': 'true' }, [el('i', { class: 'en-sun' }), el('i', { class: 'en-cloud en-cloud--1' }), el('i', { class: 'en-cloud en-cloud--2' }), el('i', { class: 'en-isle en-isle--1' }), el('i', { class: 'en-waves' })]);
        const brand = el('div', { class: 'en-card__brand' }, [el('span', { class: 'app-name' }, [el('span', { class: 'bn-main', text: '小小算術家' }), el('span', { class: 'bn-colon', text: '：' }), el('span', { class: 'bn-sub', text: '六島大冒險' })])]);
        const card = el('div', { class: 'ds-card ds-card--canvas en-card sp-card sc-card st-card' }, [brand, el('h1', { class: 'ds-plank en-card__title', text: title })].concat(body));
        const s = el('div', { id: id, class: 'screen en-screen sp-screen sc-screen st-screen' }, [sea, el('div', { class: 'en-wrap en-wrap--card' }, [card])]);
        document.body.appendChild(s);
        return s;
    }
    function open(id) { if (typeof switchScreen === 'function') switchScreen(id); }

    function zoneText(a) {
        if (a.zone === 'ALL') return '三個區域（學習區、練習區、精熟區）都要完成';
        return ZONE_ZH[a.zone] || String(a.zone || '');
    }
    /* 分類：看不懂的狀態一律歸「無法判定」，不歸成「未完成」 */
    function category(a) {
        const s = String(a.my_status || '');
        if (DONE[s]) return 'done';
        if (s === 'overdue_incomplete') return 'overdue';
        if (s === 'closed_incomplete') return 'closed';
        if (s === 'not_started' || s === 'in_progress') return a.closed ? 'closed' : 'todo';
        return 'undetermined';
    }
    function build() {
        if ($('screen-st-tasks')) return;
        mkScreen('screen-st-tasks', '老師任務', [
            para(NOTE, 'tp-note'),
            el('div', { id: 'stt-pending' }),
            el('p', { id: 'stt-summary', class: 'tp-hint', role: 'status' }),
            el('div', { id: 'stt-list' }),
            el('div', { id: 'stt-quizzes' }),
            el('p', { id: 'stt-msg', class: 'ds-error en-error', role: 'alert' }),
            btn('重新整理', 'ds-btn--sea', function () { load(this); }, 'stt-refresh'),
            btn('回我的班級', 'ds-btn--ghost en-back', function () { if (typeof StudentClass !== 'undefined') StudentClass.openEntry(); }, 'stt-class'),
            btn('回到海圖', 'ds-btn--ghost en-back', function () { open('screen-map'); }, 'stt-back')
        ]);
    }

    function card(a) {
        const cat = category(a);
        const chipCls = { todo: 'ds-chip--info', done: 'ds-chip--success', overdue: 'ds-chip--warn', closed: 'stt-chip--plain', undetermined: 'stt-chip--plain' }[cat];
        const label = cat === 'undetermined' ? '無法判定' : (a.status_label || '');
        const head = el('div', { class: 'stt-head' }, [el('h3', { class: 'stt-title', text: a.title || '' }), el('span', { class: 'ds-chip stt-chip ' + chipCls, text: label })]);
        const c = el('article', { class: 'stt-card stt-' + cat, 'data-status': String(a.my_status || ''), 'data-cat': cat }, [head]);
        c.appendChild(para('指定：' + (a.island || '') + '　' + zoneText(a), 'stt-meta'));
        c.appendChild(para(a.due_date ? ('截止日：' + a.due_date + '（含當天）') : '沒有截止日', 'stt-meta'));
        if (a.description) c.appendChild(para(a.description, 'stt-desc'));
        if (cat === 'done') {
            c.appendChild(para(a.time_unknown ? '完成時間不明（這是任務發布前就有的進度）' : ('完成時間：' + String(a.completed_at || '').replace('T', ' ').slice(0, 16)), 'stt-meta'));
            if (a.closed) c.appendChild(para('這個任務老師已經關閉。', 'stt-meta'));
        } else if (cat === 'todo') {
            c.appendChild(para('回到海圖，選「' + (a.island || '') + '」就可以練習。其他島嶼也都可以玩。', 'stt-meta'));
        } else if (cat === 'overdue') {
            c.appendChild(para('已經超過截止日，還沒有完成。你還是可以照常練習，也可以告訴老師。', 'stt-meta'));
        } else if (cat === 'closed') {
            c.appendChild(para('老師已經關閉這個任務，關閉的時候還沒有完成。', 'stt-meta'));
        } else {
            c.appendChild(para(UNDET, 'stt-meta'));
        }
        return c;
    }
    function render() {
        const list = $('stt-list'), sum = $('stt-summary'); if (!list) return;
        list.textContent = ''; sum.textContent = '';
        if (!st.data) { list.appendChild(para(st.error || '載入中…', 'tp-hint')); return; }
        const d = st.data;
        if (d.enabled === false) { list.appendChild(para('老師任務功能目前還沒有開放。你可以照常自己冒險。', 'tp-hint')); return; }
        const all = Array.isArray(d.assignments) ? d.assignments : [];
        if (!all.length) { list.appendChild(para(d.note || '目前沒有老師任務。沒有任務也沒關係，可以照常自己冒險。', 'tp-hint')); return; }
        const groups = {}; all.forEach(function (a) { const k = category(a); (groups[k] = groups[k] || []).push(a); });
        sum.textContent = SECTIONS.filter(function (s) { return groups[s.key]; }).map(function (s) { return s.title + ' ' + groups[s.key].length; }).join('　');
        SECTIONS.forEach(function (s) {
            const g = groups[s.key]; if (!g) return;
            const sec = el('section', { class: 'stt-sec', 'data-cat': s.key, 'aria-labelledby': 'stt-h-' + s.key }, [el('h2', { class: 'tp-hello', id: 'stt-h-' + s.key, text: s.title + '（' + g.length + '）' })]);
            g.forEach(function (a) { sec.appendChild(card(a)); });
            list.appendChild(sec);
        });
    }
    /* 載入清單；回傳 true／false（讀到了／沒讀到）。沒讀到時保留上次的資料並說明，不顯示成沒有任務。 */
    async function load(button) {
        if (st.busy) return false;
        say('stt-msg', '');
        if (!online()) { st.error = '目前是示範模式（沒有連到後端），看不到老師任務。'; if (!st.data) render(); say('stt-msg', st.error); return false; }
        st.busy = true; if (button) button.disabled = true;
        let ok = false;
        try {
            const r = await apiCall({ action: 'list_student_assignments' });
            if (r && r.code === 'SESSION_INVALID' && AuthSession.student && typeof SessionGuard !== 'undefined') { SessionGuard.studentExpired(); return false; }
            if (r && r.status === 'success') { st.data = r; st.error = ''; st.loadedAt = Date.now(); ok = true; }
            else { st.error = '現在讀不到老師任務（' + ((r && r.message) || '連線失敗') + '）。這不代表沒有任務，請稍後再按「重新整理」。'; }
        } catch (e) { console.error(e); st.error = '現在讀不到老師任務。這不代表沒有任務，請稍後再按「重新整理」。'; }
        finally { st.busy = false; if (button) button.disabled = false; }
        render();
        if (!ok) say('stt-msg', st.error);
        if (typeof TaskRun !== 'undefined') TaskRun.paintPending();
        if (ok && typeof StudentQuiz !== 'undefined') StudentQuiz.loadInto($('stt-quizzes'));   /* 階段 10：老師測驗放在同一個畫面，不另設入口 */
        return ok;
    }
    async function openScreen() {
        build(); render(); open('screen-st-tasks');
        if (typeof TaskRun !== 'undefined') TaskRun.paintPending();
        await load();
    }
    /* 給「完成後提示」用：這次完成的區域，有沒有還沒完成的進行中任務？ true／false／null（不知道） */
    function relevantFor(island, zone) {
        if (!st.data || !Array.isArray(st.data.assignments)) return null;
        return st.data.assignments.some(function (a) {
            if (a.closed || a.island !== island) return false;
            if (a.zone !== 'ALL' && a.zone !== zone) return false;
            return !DONE[String(a.my_status || '')];
        });
    }
    function reset() { st.data = null; st.error = ''; st.busy = false; st.loadedAt = 0; ['stt-list', 'stt-pending', 'stt-summary', 'stt-msg'].forEach(function (id) { const e = $(id); if (e) e.textContent = ''; }); }

    return { open: openScreen, load: load, relevantFor: relevantFor, reset: reset, category: category, _state: st };
})();
