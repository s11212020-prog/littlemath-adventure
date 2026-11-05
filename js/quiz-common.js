/* 階段 10：老師測驗共用小工具（教師端、學生端都會用）。
   * 所有文字都用 textContent 寫入，不把資料當成 HTML。
   * modal：自製確認視窗（role="dialog"，Esc 取消、焦點回到原按鈕），用來說明「送出」「公布結果」「發布」會發生什麼事。
   * 不使用任何瀏覽器儲存空間。 */
const QZU = (function () {
    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = String(text); return e; }
    function btn(text, fn, cls, id) { const b = el('button', cls || 'btn-view', text); b.type = 'button'; if (id) b.id = id; if (fn) b.addEventListener('click', fn); return b; }
    function when(t) { return t ? String(t).replace('T', ' ').slice(0, 16) : '—'; }
    function clear(n) { n.textContent = ''; return n; }
    function lifeRing(text) {
        const src = document.querySelector('#loading .lf'); const w = el('div', 'qz-loading'); w.setAttribute('role', 'status');
        if (src) { const c = src.cloneNode(true); c.classList.add('qz-lf'); w.appendChild(c); }
        w.appendChild(el('p', 'qz-loading__t', text || '讀取中…')); return w;
    }
    function stateBox(kind, text, retry) {
        const b = el('div', 'qz-state qz-state--' + kind); b.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        b.appendChild(el('p', 'qz-state__t', text)); if (retry) b.appendChild(btn('重新讀取', retry, 'ds-btn ds-btn--gold ds-btn--sm')); return b;
    }
    /* 20 秒沒有回應就當作逾時；不會讓畫面一直轉圈 */
    function withTimeout(p, ms) {
        return new Promise(function (resolve) {
            const t = setTimeout(function () { resolve({ status: 'error', code: 'TIMEOUT', message: '連線逾時，請檢查網路後再試一次' }); }, ms || 20000);
            p.then(function (r) { clearTimeout(t); resolve(r); }, function (e) { clearTimeout(t); console.error(e); resolve({ status: 'error', code: 'NETWORK', message: '連線失敗，請檢查網路後再試一次' }); });
        });
    }
    function errText(r) {
        if (!r) return '';
        const M = { FEATURE_OFF: '老師測驗功能目前還沒有開放。', SCHEMA_NOT_READY: '測驗資料表尚未建立，請管理員完成設定。', NOT_FOUND_OR_FORBIDDEN: '找不到這項資料，或你沒有權限查看。',
            QUIZ_LOCKED: '這份測驗已經發布，題目已固定。請按「建立新版本」再修改。' };
        return M[r.code] || r.message || '發生問題，請稍後再試。';
    }
    /* 確認視窗：回傳 Promise<boolean>。lines 是一段一段的說明文字。 */
    function modal(opt) {
        return new Promise(function (resolve) {
            const prevFocus = document.activeElement;
            const ov = el('div', 'qz-modal'); ov.setAttribute('role', 'presentation');
            const box = el('div', 'qz-modal__box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'qz-modal-h');
            const h = el('h2', 'qz-modal__h', opt.title || '請確認'); h.id = 'qz-modal-h'; box.appendChild(h);
            (opt.lines || []).forEach(function (l) { box.appendChild(el('p', 'qz-modal__p', l)); });
            if (opt.list) { const ul = el('ul', 'qz-modal__ul'); opt.list.forEach(function (x) { ul.appendChild(el('li', null, x)); }); box.appendChild(ul); }
            const row = el('div', 'qz-modal__row');
            const done = function (v) { document.removeEventListener('keydown', onKey, true); if (ov.parentNode) ov.parentNode.removeChild(ov); try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) { /* ignore */ } resolve(v); };
            const no = btn(opt.cancel || '取消', function () { done(false); }, 'ds-btn ds-btn--ghost ds-btn--sm', 'qz-modal-cancel');
            const yes = btn(opt.ok || '確定', function () { done(true); }, 'ds-btn ds-btn--gold ds-btn--sm', 'qz-modal-ok');
            if (opt.hideCancel) row.appendChild(yes); else { row.appendChild(no); row.appendChild(yes); }
            box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov);
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
                else if (e.key === 'Tab') { const f = [no, yes].filter(function (x) { return x.parentNode; }); const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
            }
            document.addEventListener('keydown', onKey, true);
            (opt.focusCancel ? no : yes).focus();
        });
    }
    function closeAllModals() { document.querySelectorAll('.qz-modal').forEach(function (m) { if (m.parentNode) m.parentNode.removeChild(m); }); }
    function mkScreen(id, extraCls, headHtmlFn) {
        if (document.getElementById(id)) return document.getElementById(id);
        const s = el('div', 'screen td-screen qz-screen ' + (extraCls || '')); s.id = id; s.style.background = 'var(--bg-paper)';
        const c = el('div', 'admin-container td-container qz-container'); s.appendChild(c); document.body.appendChild(s); if (headHtmlFn) headHtmlFn(c); return s;
    }
    return { el: el, btn: btn, when: when, clear: clear, lifeRing: lifeRing, stateBox: stateBox, withTimeout: withTimeout, errText: errText, modal: modal, closeAllModals: closeAllModals, mkScreen: mkScreen };
})();
