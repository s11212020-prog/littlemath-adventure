/* 答題流程狀態機與鍵盤 */
        // ==========================================================================
        //  答題流程狀態機（滑鼠與 Enter 共用同一組函式）
        //  IDLE → ANSWERING → SUBMITTING → (答錯) ANSWERING / (答對) CORRECT_FEEDBACK → NEXT_READY | FINISHED
        // ==========================================================================
        const QF = { state: 'IDLE', busy: false, keyLockUntil: 0, composing: false, attached: false, onEdit: function () { if (QF.state === 'WRONG_FEEDBACK') QF.state = 'ANSWERING'; } };
        function goToNextQuestion(source) {
            if (source === 'key') { if (QF.state !== 'NEXT_READY') return false; }
            else if (QF.state !== 'NEXT_READY' && QF.state !== 'CORRECT_FEEDBACK') return false;
            QF.state = 'ANSWERING'; QF.keyLockUntil = Date.now() + KEY_CONFIG.lockMs;      // 先改狀態再切題 → 重複呼叫會被擋下
            GameFlowController.loadNextQuestion(); renderUI(); return true;
        }
        function nextQ() { return goToNextQuestion('click'); }
        function submitCurrent() {
            const s = GameFlowController.state;
            if (s.island === "應用題島") { if (s.currentQ && s.currentQ.isTwoStep) return TwoStepUI.submit(); return WordProblemUI.submit(); }
            return submitAns();
        }
        function isAnswerElement(t) {
            if (!t) return true; const tag = String(t.tagName || '').toUpperCase();
            if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return false;     // 這些元素保留原生 Enter 行為
            if (tag === 'INPUT') return !!(t.classList && t.classList.contains('qa-input'));
            return true;
        }
        const QuestionKeys = {
            onKeyDown: function (ev) {
                if (!ev || ev.key !== 'Enter' || ev.repeat || ev.isComposing || ev.keyCode === 229 || QF.composing) return;
                const sg = document.getElementById('screen-game'); if (!sg || !sg.classList.contains('active')) return;
                const mr = document.getElementById('modal-report'); if (mr && mr.style.display === 'flex') return;
                const av = document.getElementById('animation-view'); if (av && av.style.display === 'flex') return;
                if (!isAnswerElement(ev.target)) return;
                if (Date.now() < QF.keyLockUntil) { if (ev.preventDefault) ev.preventDefault(); return; }
                if (QF.state === 'WRONG_FEEDBACK') {      // 答錯後第一次 Enter：只把焦點放回答案欄（避免連按 Enter 把同一個錯誤答案重複送出、提示一路升級）
                    if (ev.preventDefault) ev.preventDefault(); QF.state = 'ANSWERING'; QF.keyLockUntil = Date.now() + 120;
                    const box = document.getElementById(GameFlowController.state.island === "應用題島" ? (GameFlowController.state.currentQ && GameFlowController.state.currentQ.isTwoStep ? TwoStepUI.focusId() : 'wp-answer-input') : 'ui-input');
                    if (box && box.focus) { box.focus({ preventScroll: true }); if (box.select) box.select(); } return;
                }
                if (QF.state === 'ANSWERING' && !QF.busy) { if (ev.preventDefault) ev.preventDefault(); QF.keyLockUntil = Date.now() + 120; submitCurrent(); }
                else if (QF.state === 'NEXT_READY') { if (ev.preventDefault) ev.preventDefault(); goToNextQuestion('key'); }
                else if (QF.state === 'FINISHED') { if (ev.preventDefault) ev.preventDefault(); QF.keyLockUntil = Date.now() + KEY_CONFIG.lockMs; backToMap(); }
            },
            onCompStart: function () { QF.composing = true; }, onCompEnd: function () { QF.composing = false; },
            attach: function () { if (QF.attached) return; QF.attached = true; document.addEventListener('keydown', this.onKeyDown); document.addEventListener('compositionstart', this.onCompStart); document.addEventListener('compositionend', this.onCompEnd); },
            detach: function () { if (!QF.attached) return; QF.attached = false; document.removeEventListener('keydown', this.onKeyDown); document.removeEventListener('compositionstart', this.onCompStart); document.removeEventListener('compositionend', this.onCompEnd); }
        };

