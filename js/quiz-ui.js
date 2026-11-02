/* 答題介面：應用題、基礎題、送出、鍵盤 */
        function showWordProblemNextAction(nextAction) {
            const submitBtn = document.getElementById('wp-btn-submit'), nextBtn = document.getElementById('wp-btn-next'), finishBtn = document.getElementById('wp-btn-finish');
            if (nextAction === "RESET") { submitBtn.style.display = ''; nextBtn.classList.remove('is-visible'); finishBtn.classList.remove('is-visible'); } 
            else if (nextAction === "FINISH") { submitBtn.style.display = 'none'; nextBtn.classList.remove('is-visible'); finishBtn.classList.add('is-visible'); } 
            else { submitBtn.style.display = 'none'; nextBtn.classList.add('is-visible'); finishBtn.classList.remove('is-visible'); }
        }
        function showBasicNextAction(nextAction) {
            const submitBtn = document.getElementById('btn-submit'), nextBtn = document.getElementById('btn-next'), finishBtn = document.getElementById('btn-finish');
            if (nextAction === "RESET") { submitBtn.style.display = ''; nextBtn.classList.remove('is-visible'); finishBtn.classList.remove('is-visible'); } 
            else if (nextAction === "FINISH") { submitBtn.style.display = 'none'; nextBtn.classList.remove('is-visible'); finishBtn.classList.add('is-visible'); } 
            else { submitBtn.style.display = 'none'; nextBtn.classList.add('is-visible'); finishBtn.classList.remove('is-visible'); }
        }

        // 組成上傳到 Google Sheet 的作答紀錄（基礎題與應用題共用）
        function buildAnswerPayload(res, studentAnswer, extra) {
            const s = GameFlowController.state; const q = s.currentQ; const two = !!q.isTwoStep;
            const wrongs = two ? (s.wrongs || 0) : Math.max(0, s.attempts - (res.isCorrect ? 1 : 0));
            const p = {
                action: 'submit_answer', username: currentUser.username, user_id: currentUser.user_id,
                island: s.island, stage: s.zone, operation: q.operation, difficulty: q.level,
                template_id: q.template_id, question_fingerprint: q.fingerprint, expression: q.expression,
                question_text: q.isWord ? `[${two ? '兩步驟' : ''}應用題] ${q.expression}` : q.expression,
                log_id: genLogId(), session_id: SESSION_ID, correct_answer: q.correctAnswer, student_answer: studentAnswer,
                is_correct: res.isCorrect, attempt_count: s.attempts, hint_level: res.hintLvl,
                hints_used: Math.max(0, Math.min(3, wrongs)),
                response_time_ms: Math.max(0, Date.now() - (s.qStart || Date.now())),
                error_code: res.errCode, error_diagnosis: res.msg,
                question_type: two ? 'two_step' : (q.isWord ? 'single_step' : 'basic'), step_count: two ? 2 : 1,
                student_expression: (extra && extra.expr) || '', first_try_correct: res.isCorrect ? (res.firstTry === undefined ? s.attempts === 1 : !!res.firstTry) : false,
                adaptive_reason: res.adaptiveReason || ''
            };
            if (res.isCorrect && (res.nextAct === "FINISH" || res.nextAct === "NEXT_ZONE")) { p.update_stars = currentUser.total_stars; p.update_progress = currentUser.progress; }
            /* 9D-2：完成一個區域時，附上完成回報（run_id 由 task-run.js 在進入區域時產生；後端沒開任務功能時會直接忽略） */
            if (typeof TaskRun !== 'undefined' && p.update_progress) { const c = TaskRun.completionFor(res, s); if (c) p.completion = c; }
            return p;
        }
        /* 送出作答：一般作答送出就不管；完成一區的那一筆會回傳「送出狀態」，讓結果卡能顯示任務提示（沒有 TaskRun 時退回原本的做法） */
        function sendAnswer(payload) {
            if (typeof TaskRun !== 'undefined') return TaskRun.send(payload);
            apiCall(payload); return null;
        }

        const WordProblemUI = {
            selectedOp: null,
            render: function(q) {
                this.selectedOp = null; document.querySelectorAll('.btn-op').forEach(btn => { btn.classList.remove('selected'); btn.setAttribute('aria-pressed', 'false'); });
                let ansBox = document.getElementById('wp-answer-input'); ansBox.value = ""; ansBox.disabled = false; ansBox.classList.remove('apply-shake');
                document.getElementById('wp-unit-label').innerText = q.unit || "個"; showWordProblemNextAction("RESET");
                document.getElementById('wp-story-text').innerHTML = `<span class="word-problem-text" id="wp-content">${escapeHTML(q.expression)}</span>`;
                FB.set('wp-feedback', "請先判斷要用什麼方法，再算出答案！", 'info');
            },
            selectOp: function(op) { if(document.getElementById('wp-answer-input').disabled) return; this.selectedOp = op; document.querySelectorAll('.btn-op').forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); }); let idMap = {"+":"op-add", "-":"op-sub", "*":"op-mul", "/":"op-div"}; const sel = document.getElementById(idMap[op]); sel.classList.add('selected'); sel.setAttribute('aria-pressed', 'true'); },
            speakQuestion: function() { if (Narrator.supported()) Narrator.speakNow(GameFlowController.state.currentQ.expression); else FB.set('wp-feedback', "您的瀏覽器不支援語音功能喔！可以自己讀一讀題目。", 'info'); },
            highlightKeywords: function(q) {
                let content = escapeHTML(q.expression);
                (q.params.keywords || []).forEach(kw => { const k = escapeHTML(kw); content = content.replace(k, `<span class="highlight-hint">${k}</span>`); });
                document.getElementById('wp-story-text').innerHTML = `<span class="word-problem-text">${content}</span>`;
            },
            submit: async function() {
                if ((QF.state !== 'ANSWERING' && QF.state !== 'WRONG_FEEDBACK') || QF.busy) return;
                let ans = document.getElementById('wp-answer-input').value.trim(); let op = this.selectedOp;
                if (!op || ans === "") { FB.set('wp-feedback', "⚠️ 請先選擇一個方法，並輸入答案喔！", 'error'); EffectEngine.shakeElement('wp-answer-input'); return; }
                QF.busy = true; QF.state = 'SUBMITTING';
                try {
                    let s = GameFlowController.state; let q = s.currentQ; let res = GameFlowController.submitAnswer(ans, op);
                    FB.set('wp-feedback', res.msg, res.isCorrect ? "success" : "error", { hint: res.isCorrect ? 0 : res.hintLvl });
                    let sent = null; if (currentUser) { try { sent = sendAnswer(buildAnswerPayload(res, `${q.params.a} ${OP_SYM[op] || "？"} ${q.params.b} = ${ans}`)); } catch(e) { console.error(e); } }
                    if (!res.isCorrect) {
                        EffectEngine.shakeElement('wp-answer-input'); if (res.highlight) this.highlightKeywords(q);
                        QF.state = 'WRONG_FEEDBACK';
                        const box = document.getElementById('wp-answer-input'); if (box && box.focus) box.focus({ preventScroll: true });
                    } else {
                        document.getElementById('wp-answer-input').disabled = true; showWordProblemNextAction(res.nextAct); QF.state = 'CORRECT_FEEDBACK';
                        if (res.earnedStars > 0) { await EffectEngine.flyStar(); }
                        QF.state = res.nextAct === "FINISH" ? 'FINISHED' : 'NEXT_READY';
                        if (res.nextAct === "FINISH") { IslandUI.showResult(); if (sent && typeof TaskRun !== 'undefined') TaskRun.afterFinish(sent); }
                    }
                } catch (e) { console.error(e); if (QF.state === 'SUBMITTING') QF.state = 'ANSWERING'; }
                finally { QF.busy = false; }
            }
        };

        function renderUI() {
            QF.state = 'ANSWERING'; QF.busy = false;
            let s = GameFlowController.state; let zoneZh = IslandUI.zoneName(s.zone);
            document.getElementById('ui-island-stars').innerText = s.stars;
            IslandUI.paintHUD(); document.getElementById('ui-progress-path').innerHTML = IslandUI.progressHTML(s);
            IslandUI.hideResult();

            if (s.island === "應用題島") {
                document.getElementById('interactive-view').style.display = 'none'; document.getElementById('word-problem-view').style.display = 'flex';
                document.getElementById('wp-zone').innerText = zoneZh;
                if (s.currentQ.isTwoStep) TwoStepUI.render(s.currentQ); else { TwoStepUI.hide(); WordProblemUI.render(s.currentQ); }
            } else {
                document.getElementById('word-problem-view').style.display = 'none'; document.getElementById('interactive-view').style.display = 'flex';
                document.getElementById('ui-zone-badge-basic').innerText = zoneZh;
                const uiInput = document.getElementById('ui-input'); uiInput.value = ""; uiInput.disabled = false; uiInput.classList.remove('apply-shake');
                showBasicNextAction("RESET");
                document.getElementById('ui-expression').innerHTML = s.currentQ.expression.split(" ").map((p, idx) => `<span id="expr-part-${idx}">${escapeHTML(p)}</span>`).join("");
                FB.set('ui-feedback', "請算出紙卡上的答案！", 'info');
                if (uiInput.focus) uiInput.focus({ preventScroll: true });
            }
        }

        async function submitAns() {
            if ((QF.state !== 'ANSWERING' && QF.state !== 'WRONG_FEEDBACK') || QF.busy) return;
            const uiInput = document.getElementById('ui-input');
            if(uiInput.value === "") { FB.set('ui-feedback', "⚠️ 請輸入答案喔！", 'error'); EffectEngine.shakeElement('ui-input'); return; }
            QF.busy = true; QF.state = 'SUBMITTING';
            try {
                const typed = uiInput.value; const q = GameFlowController.state.currentQ; let res = GameFlowController.submitAnswer(typed);
                FB.set('ui-feedback', res.msg, res.isCorrect ? "success" : "error", { hint: res.isCorrect ? 0 : res.hintLvl });
                let sent = null; if(currentUser) { try { sent = sendAnswer(buildAnswerPayload(res, typed)); } catch(e) { console.error(e); } }

                if (!res.isCorrect) {
                    EffectEngine.shakeElement('ui-input'); 
                    if (res.highlight) {
                        const t = q.template_id; let idx = [];
                        if (t.endsWith("_BASIC")) idx = [1];
                        else if (t === "MD_FIRST") idx = [2,3,4];
                        else if (t === "PAREN_AS_SUB" || t === "PAREN_DIV_MUL") idx = [0,1,2,3,4];
                        else if (t === "LR_MD" || t === "LR_AS") idx = [0,1,2];
                        idx.forEach(i => { const el = document.getElementById(`expr-part-${i}`); if (el) el.classList.add('highlight-hint'); });
                    }
                    QF.state = 'WRONG_FEEDBACK'; if (uiInput.focus) uiInput.focus({ preventScroll: true });
                } else {
                    uiInput.disabled = true; showBasicNextAction(res.nextAct); QF.state = 'CORRECT_FEEDBACK';
                    if (res.earnedStars > 0) { await EffectEngine.flyStar(); }
                    QF.state = res.nextAct === "FINISH" ? 'FINISHED' : 'NEXT_READY';
                    if (res.nextAct === "FINISH") { IslandUI.showResult(); if (sent && typeof TaskRun !== 'undefined') TaskRun.afterFinish(sent); }
                }
            } catch (e) { console.error(e); if (QF.state === 'SUBMITTING') QF.state = 'ANSWERING'; }
            finally { QF.busy = false; }
        }

        // 數字鍵盤：0-9 輸入、C 清除、< 倒退
        function typeNum(k) {
            const input = document.getElementById('ui-input');
            if (!input || input.disabled) return;
            let v = String(input.value || "");
            if (k === 'C') v = "";
            else if (k === '<') v = v.slice(0, -1);
            else if (v.length < 5) v = (v === "0") ? String(k) : v + String(k);
            input.value = v; QF.onEdit();
            input.focus({ preventScroll: true });
        }
