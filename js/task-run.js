/* 階段 9D-2：完成回報（run_id）、重新送出、完成後的任務提示
   * 每次「進入一個區域」（GameFlowController.enterZone）就換一個新的 run_id；同一次練習的完成回報一律用同一個 run_id，
     重新送出時也用同一個，所以後端不會重複計算（重複會回 duplicate）。這裡只包住 enterZone，不修改 questions.js。
   * 一般作答仍然是「送出就不管」；只有「完成一個區域」的那一筆會等後端回應，才能分辨：
       「作答進度已存，但任務尚未計入」（後端有收到，只是完成事件沒記上）
       「暫時無法確認儲存結果」（連線失敗或沒有收到回應：不知道後端有沒有收到，所以不說「已存」也不說「沒存」，請重新送出再確認）
     只有後端明確回覆成功，才說作答進度已存；只有 recorded／duplicate，才說完成事件已記錄。
   * 沒有加入班級的學生：不顯示任何任務提示，行為和以前完全一樣（照常自己冒險）。
   * 沒有送出成功的完成回報只存在這個分頁的記憶體裡，不寫入 localStorage／sessionStorage／Cookie。
   * 畫面文字一律用 textContent 寫入。 */
const TaskRun = (function () {
    const $ = function (id) { return document.getElementById(id); };
    const st = { run: null, pending: {}, seq: 0 };
    const OK = { recorded: 1, duplicate: 1 };

    function rand36() {
        try {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) { const a = new Uint32Array(2); crypto.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); }
        } catch (e) { /* 用備援 */ }
        return Math.floor(Math.random() * 1e9).toString(36) + Math.floor(Math.random() * 1e9).toString(36);
    }
    /* 格式要符合後端的 /^[A-Za-z0-9_-]{8,64}$/ */
    function genRunId() { return ('RUN_' + Date.now().toString(36) + '_' + rand36()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64); }
    function newRun(island, zone) { st.run = { id: genRunId(), island: island || '', zone: zone || '' }; return st.run.id; }
    /* 這個區域目前這一次練習的 run_id；萬一沒有經過 enterZone（或島嶼區域對不上），就補一個新的 */
    function runIdFor(island, zone) {
        if (!st.run || st.run.island !== island || st.run.zone !== zone) newRun(island, zone);
        return st.run.id;
    }
    /* 包住 enterZone：每次進入區域換新 run_id */
    function install() {
        if (typeof GameFlowController === 'undefined' || GameFlowController.__taskRunWrapped) return;
        const orig = GameFlowController.enterZone;
        GameFlowController.enterZone = function (z) {
            newRun(this.state.island, z);
            return orig.apply(this, arguments);
        };
        GameFlowController.__taskRunWrapped = true;
    }

    /* 完成回報：只有「完成一個區域」那一筆才帶 completion */
    function completionFor(res, state) {
        if (!res || !res.isCorrect || res.nextAct !== 'FINISH') return null;
        const stars = Number(res.earnedStars || state.stars);
        if (!(stars === 1 || stars === 2 || stars === 3)) return null;
        return { run_id: runIdFor(state.island, state.zone), island: state.island, zone: state.zone, stars: stars };
    }

    function inClass() {
        try { const i = StudentClass._state.info; return !!(i && i.membership && i.membership.status === 'active'); } catch (e) { return false; }
    }
    function classify(r) {
        if (!r) return { state: 'notsaved', resend: true };
        if (r.status === 'offline') return { state: 'offline', resend: false };
        if (r.status !== 'success') return { state: 'notsaved', resend: !(r.code === 'SESSION_INVALID' || r.code === 'MUST_CHANGE_PIN'), message: r.message || '' };
        const c = r.completion;
        if (!c) return { state: 'nocompletion', resend: false };          /* 後端沒有開任務功能：不用提示 */
        if (OK[c.status]) return { state: 'counted', resend: false };
        if (c.status === 'error') return { state: 'retry', resend: true, message: c.message || '' };
        if (c.status === 'no_session') return { state: 'nosession', resend: false, message: c.message || '' };
        if (c.status === 'missing_run_id') return { state: 'refresh', resend: false, message: c.message || '' };
        return { state: 'rejected', resend: false, message: c.message || '' };           /* invalid、conflict、其他 */
    }

    async function post(entry) {
        entry.state = 'sending';
        let r = null;
        try { r = await apiCall(entry.payload); } catch (e) { console.error(e); r = null; }
        const c = classify(r);
        entry.state = c.state; entry.resend = c.resend; entry.message = c.message || '';
        if (c.state === 'counted' || c.state === 'nocompletion' || c.state === 'offline') delete st.pending[entry.run_id];
        else st.pending[entry.run_id] = entry;
        return entry;
    }
    /* 送出一筆作答。沒有完成回報的一般作答：送出就不管（和以前一樣）；有完成回報的：回傳 entry，呼叫端可等結果 */
    function send(payload) {
        if (!payload || !payload.completion) { try { apiCall(payload); } catch (e) { console.error(e); } return null; }
        const entry = { run_id: payload.completion.run_id, island: payload.completion.island, zone: payload.completion.zone, payload: payload, state: 'sending', resend: false, message: '', promise: null };
        entry.promise = post(entry);
        return entry;
    }
    /* 重新送出：同一個 run_id、同一題的 log_id；進度改帶最新的（本機進度只增不減，仍包含這次完成的紀錄） */
    function resend(entry) {
        if (!entry || entry.state === 'sending' || !entry.resend) return null;
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.progress) entry.payload = Object.assign({}, entry.payload, { update_progress: currentUser.progress, update_stars: currentUser.total_stars });
        entry.promise = post(entry);
        paintAll();
        entry.promise.then(function () { paintAll(); if (entry.state === 'counted' && typeof StudentTasks !== 'undefined') StudentTasks.load(); });
        return entry.promise;
    }

    const TXT = {
        sending: ['正在送出這次完成', '作答進度和任務紀錄正在送出，請稍等一下。'],
        counted: ['這次完成已送出', '作答進度已存，這次完成也已經記錄。任務的最新狀態可以到「老師任務」查看。'],
        retry: ['作答進度已存，任務尚未計入', '你的作答和星星已經存好了，只是這次完成還沒有送到老師任務。請按「重新送出」再試一次。'],
        notsaved: ['暫時無法確認儲存結果', '網路好像不穩，目前無法確認作答進度與任務紀錄是否已儲存。請按「重新送出」再確認一次。'],
        nosession: ['作答進度已存，任務尚未計入', '請重新登入後，再練習一次這一區，這次完成才會計入老師任務。'],
        refresh: ['作答進度已存，任務尚未計入', '請重新整理網頁，再練習一次這一區，這次完成才會計入老師任務。'],
        rejected: ['作答進度已存，任務尚未計入', '這次完成的資料沒有被收進老師任務。請再練習一次這一區。']
    };
    function el(tag, props, kids) {
        const e = document.createElement(tag);
        if (props) Object.keys(props).forEach(function (k) {
            if (k === 'text') e.textContent = props[k];
            else if (k === 'class') e.className = props[k];
            else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), props[k]);
            else e.setAttribute(k, props[k]);
        });
        (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
        return e;
    }
    function noticeBox(entry, idPrefix) {
        const t = TXT[entry.state] || TXT.rejected;
        const ok = entry.state === 'counted';
        const box = el('div', { class: 'tn tn--' + (ok ? 'ok' : (entry.state === 'sending' ? 'wait' : 'warn')), 'data-state': entry.state, role: 'status' });
        box.appendChild(el('p', { class: 'tn__head', text: t[0] }));
        box.appendChild(el('p', { class: 'tn__body', text: t[1] }));
        const act = el('div', { class: 'tn__act' });
        if (entry.resend && entry.state !== 'sending') {
            const b = el('button', { type: 'button', class: 'ds-btn ds-btn--gold ds-btn--sm', id: idPrefix + '-resend', text: '重新送出' });
            b.addEventListener('click', function () { resend(entry); });
            act.appendChild(b);
        }
        if (typeof StudentTasks !== 'undefined' && entry.state !== 'sending') {
            const v = el('button', { type: 'button', class: 'ds-btn ds-btn--sea ds-btn--sm', id: idPrefix + '-view', text: '看老師任務' });
            v.addEventListener('click', function () { StudentTasks.open(); });
            act.appendChild(v);
        }
        if (act.childNodes.length) box.appendChild(act);
        return box;
    }
    function paintResult(entry) {
        const host = $('island-result'); if (!host || !host.classList.contains('is-visible')) return;
        const old = $('task-notice'); if (old && old.parentNode) old.parentNode.removeChild(old);
        if (!entry || entry.hidden) return;
        const wrap = el('div', { id: 'task-notice', class: 'tn-wrap', 'aria-live': 'polite' }, [noticeBox(entry, 'tn')]);
        host.appendChild(wrap);
    }
    function paintPending() {
        const host = $('stt-pending'); if (!host) return;
        host.textContent = '';
        Object.keys(st.pending).forEach(function (k) {
            const e = st.pending[k]; if (e.state === 'counted') return;
            const box = noticeBox(e, 'tp-' + k);
            const lab = el('p', { class: 'tn__island', text: '「' + e.island + '」' + ({ LEARNING: '學習區', PRACTICE: '練習區', MASTERY: '精熟區' }[e.zone] || e.zone) + ' 的這次完成' });
            box.insertBefore(lab, box.firstChild);
            host.appendChild(box);
        });
    }
    function paintAll() { if (st.last) paintResult(st.last); paintPending(); }

    /* 完成一區、結果卡顯示後呼叫：等後端回應，再決定要不要提示 */
    async function afterFinish(entry) {
        if (!entry) return;
        st.last = entry;
        if (!inClass()) { entry.hidden = true; return; }                         /* 沒有加入班級：不打擾 */
        entry.hidden = false;
        const rel0 = (typeof StudentTasks !== 'undefined') ? StudentTasks.relevantFor(entry.island, entry.zone) : null;   /* 送出前的任務清單：true／false／null（不知道） */
        let rel = rel0;
        if (rel0 !== false) paintResult(entry);
        await entry.promise;
        if (st.last !== entry) return;
        if (entry.state === 'counted' || entry.state === 'nocompletion' || entry.state === 'offline') {
            if (typeof StudentTasks !== 'undefined') { if (rel0 === false) { await StudentTasks.load(); rel = StudentTasks.relevantFor(entry.island, entry.zone); } else StudentTasks.load(); }
            if (st.last !== entry) return;
            entry.hidden = (rel === false) || entry.state !== 'counted'; paintAll(); return;
        }
        /* 還沒確認成功（連線失敗、事件沒記上…）：只有「送出前就確定和任何進行中任務無關」才不提示；
           不能因為重新讀到的清單上任務看起來已完成，就把提示收起來——那可能只是後端已經收到、前端沒收到回應，仍要讓學生重新送出確認。 */
        if (rel0 === false) {
            if (typeof StudentTasks !== 'undefined') { await StudentTasks.load(); rel = StudentTasks.relevantFor(entry.island, entry.zone); }
            if (st.last !== entry) return;
            if (rel === false) { entry.hidden = true; delete st.pending[entry.run_id]; paintAll(); return; }
        }
        entry.hidden = false; paintAll();
    }
    function reset() { st.run = null; st.pending = {}; st.last = null; const n = $('task-notice'); if (n && n.parentNode) n.parentNode.removeChild(n); const p = $('stt-pending'); if (p) p.textContent = ''; }

    install();
    return { send: send, completionFor: completionFor, afterFinish: afterFinish, resend: resend, reset: reset, paintPending: paintPending, newRun: newRun, runIdFor: runIdFor, genRunId: genRunId, classify: classify, install: install, pendingCount: function () { return Object.keys(st.pending).length; }, _state: st };
})();
