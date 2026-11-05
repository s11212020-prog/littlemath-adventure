/* 教師端：儀表板、分析、CSV、展示模式 */
        // ==========================================
        // 教師戰情室（篩選、概念分析、易錯題、CSV 匯出）；階段 8：版面與圖示統一、新增「匯出全部作答紀錄」，分析公式不變
        // ==========================================
        const CONCEPT_LABEL = { add: "加法", sub: "減法", mul: "乘法", div: "除法", order: "四則運算", wp_add: "應用題・加法情境", wp_sub: "應用題・減法情境", wp_mul: "應用題・乘法情境", wp_div: "應用題・除法情境", wp2: "應用題・兩步驟", wp_unknown: "應用題（舊版未分類）", other: "其他" };
        const CONCEPT_ORDER = ["add", "sub", "mul", "div", "order", "wp_add", "wp_sub", "wp_mul", "wp_div", "wp2", "wp_unknown", "other"];
        const SUMMARY_CONCEPTS = ["add", "sub", "mul", "div", "order", "wp_add", "wp_sub", "wp_mul", "wp_div", "wp2"];
        const ZONE_ZH = { LEARNING: "概念學習區", PRACTICE: "互動練習區", MASTERY: "掌握確認區" };
        const TEACHER_ADVICE = {
            ERR_ADD_CARRY_FORGOTTEN: "用個位、十位的直式（或積木）示範「滿 10 進 1」。",
            ERR_SUB_REVERSE_DIGIT: "用直式示範「借 1 變 10」，強調不能用小減大。",
            ERR_ADD_SUB_CONFUSED: "用實物操作比較「合起來」與「拿走」，讓學生說出數量變多還是變少。",
            ERR_SUB_ADD_CONFUSED: "請學生先判斷答案會比原來大還是小，再選運算。",
            ERR_MUL_ADD_CONFUSED: "用圖示畫出「幾組、每組幾個」，再寫成連加與乘法。",
            ERR_DIV_MUL_CONFUSED: "用平分實物說明除法，並用「乘法表反推」檢查答案。",
            ERR_ORDER_ADD_FIRST: "用顏色標出乘除，示範「先乘除、後加減」。",
            ERR_ORDER_PAREN_IGNORED: "要求學生先把括號圈起來，括號內先算。",
            ERR_ORDER_LEFT_TO_RIGHT: "示範同級運算（只有加減或只有乘除）要由左到右，每次只算一步。",
            ERR_CONCEPT_COMBINE: "加強「又、再、合起來、一共」等加法關鍵字與情境圖。",
            ERR_CONCEPT_TAKEAWAY: "加強「拿走、送給、用掉、剩下、比多／少」等減法關鍵字。",
            ERR_OPERATION_MISMATCH: "請學生先用自己的話說出「題目在問什麼」，再選加減乘除。",
            ERR_CALCULATION: "方法正確但算錯，建議練習驗算與分步書寫。",
            ERR_UNKNOWN: "請查看該生的錯誤答案，進行個別訪談了解想法。",
            ERR_WP_STEP1_OPERATION: "兩步驟題：請學生先圈出「第一個問題」問什麼，再決定第一步的運算，不要急著把所有數字一起算。",
            ERR_WP_STEP1_CALC: "第一步方法對、算錯：練習驗算，並把第一步的結果寫在題目旁邊再繼續。",
            ERR_WP_STEP2_OPERATION: "第一步做對、第二步選錯：提醒「第一步的結果」要拿來當第二步的數字，並重讀最後一句問題。",
            ERR_WP_STEP2_CALC: "第二步方法對、算錯：確認有用第一步的結果計算，再做驗算。",
            ERR_WP_UNIT: "數字對但單位錯：請學生圈出問題句最後的名詞（幾什麼），答案後面要帶上它。",
            ERR_WP_EXPR_FORMAT: "合併列式格式不正確：示範只用數字、＋－×÷ 和圓括號，例如 (18＋6)÷4。",
            ERR_WP_COMBINE_ORDER: "合併列式數字對、順序錯：先做的那一步要用括號包起來，括號內先算。",
            ERR_INPUT_EMPTY: ""
        };
        const CONCEPT_ADVICE = { low: "全班首次答對率偏低，建議先全班複習並用教具示範。", mid: "部分學生仍需補強，可分組輔導。", high: "掌握良好，可進入下一階段或提高難度。" };
        const ISLAND_LIST = ["加法島", "減法島", "乘法島", "除法島", "應用題島", "四則運算島"];
        const HINT_OPTS = [["", "全部"], ["used", "有使用提示"], ["none", "沒用提示"], ["stuck", "卡關（第 3 級提示）"]];

        let adminQuestions = [];   // 分組後的題目（已排除舊版無內容、空白作答）
        let adminRowsAll = [];     // 標準化後的所有作答列
        let adminFiltered = [];    // 目前篩選後的題目
        let AF = { from: "", to: "", student: "", island: "", stage: "", op: "", err: "", hint: "" };

        function pct(n, d) { return d > 0 ? Math.round(n / d * 100) : null; }
        function pctStr(v) { return v === null || v === undefined ? "—" : v + "%"; }
        function fmt1(v) { return (v === null || v === undefined || isNaN(v)) ? "—" : (Math.round(v * 10) / 10).toString(); }
        function truthy(v) { return v === true || String(v).toUpperCase() === "TRUE" || v === 1 || v === "1"; }
        function errName(code) { const c = normCode(code); return (ERROR_DICT[c] && ERROR_DICT[c].label) || c || "—"; }
        function errCatName(code) { const c = normCode(code); return (ERROR_DICT[c] && ERROR_CAT[ERROR_DICT[c].cat]) || ""; }
        function barHTML(rate) { if (rate === null || rate === undefined) return "—"; const col = rate >= 80 ? "#27ae60" : (rate >= 60 ? "#f39c12" : "#e74c3c"); return `<div class="bar"><span style="width:${rate}%;background:${col};"></span></div><div class="bar-n">${rate}%</div>`; }
        function conceptLabel(op) { return CONCEPT_LABEL[op] || op || "其他"; }
        /* 階段 8：後台畫面上的圖示一律用 ui-kit.js 的原創 SVG（不用 emoji）。只影響畫面，不寫入任何資料。 */
        function tIcon(name, size) { try { return UIKit.icon(name, { size: size || 22 }); } catch (e) { return ""; } }
        function tHydrate(root) { try { if (typeof document !== 'undefined' && document.querySelectorAll) UIKit.hydrate(root || document); } catch (e) { /* 測試環境 */ } }
        function emptyRow(cols, msg, icon) { return `<tr><td colspan="${cols}" class="td-empty">${icon ? tIcon(icon, 24) : ""}<span>${msg}</span></td></tr>`; }
        /* 顯示用的副本：拿掉裝飾用的 emoji 圖案。只用在畫面，原始資料與匯出內容不受影響。 */
        function plainText(t) { return String(t == null ? "" : t).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}\u{200D}]/gu, "").replace(/^\s+/, ""); }
        /* 台北時間 "YYYY/MM/DD HH:mm"（withSec 時加 ":ss"）。自己用 formatToParts 組字串：不同瀏覽器的 Intl 會在日期與時間之間放不同的空白字元（有的是細空白），組出來的文字才一致、Excel 也比較容易辨識。 */
        function taipeiText(d, withSec) {
            const parts = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d);
            const g = t => (parts.find(p => p.type === t) || {}).value || "";
            return g("year") + "/" + g("month") + "/" + g("day") + " " + g("hour") + ":" + g("minute") + (withSec ? ":" + g("second") : "");
        }
        const LEGACY_LABEL = "舊版紀錄／資料未保存";
        const NO_LOGIN_LABEL = "尚無紀錄";

        function deriveOp(l) {
            const op = String(l.operation || "").trim(); if (CONCEPT_LABEL[op]) return op;
            const island = ISLAND_ALIASES[l.island] || l.island; const t = String(l.template_id || "");
            if (island === "應用題島") { if (/^WP2_/.test(t)) return "wp2"; const m = t.match(/^WP_(ADD|SUB|MUL|DIV)$/); return m ? "wp_" + m[1].toLowerCase() : "wp_unknown"; }
            return CONCEPT_KEY[island] || "other";
        }
        function normLog(l) {
            const raw = l.answered_at || l.timestamp || ""; let ts = raw ? new Date(raw) : null; if (ts && isNaN(ts.getTime())) ts = null;
            return {
                raw: l, uid: String(l.user_id || l.username || ""), username: l.username || "", nickname: l.nickname_snapshot || "",
                island: ISLAND_ALIASES[l.island] || l.island || "", stage: l.stage || l.zone || "", op: deriveOp(l), template: l.template_id || "", diff: Number(l.difficulty) || 0,
                text: String(l.question_text || l.expression || ""), expr: String(l.expression || l.question_text || ""), qid: String(l.question_id || l.question_text || ""),
                correct: l.correct_answer, ans: l.student_answer, ok: truthy(l.is_correct), err: normCode(l.error_code), hint: Number(l.hint_level) || 0,
                hintsUsed: Number(l.hints_used) || 0, rt: Number(l.response_time_ms) || 0, attempt: Number(l.attempt_number !== undefined && l.attempt_number !== "" ? l.attempt_number : l.attempt_count) || 1,
                ts: ts, session: String(l.session_id || ""), status: l.data_status || "",
                qtype: String(l.question_type || (/^WP2_/.test(String(l.template_id || "")) ? "two_step" : "")), stepCount: Number(l.step_count) || 1, studentExpr: String(l.student_expression || ""),
                firstTry: (l.first_try_correct === undefined || l.first_try_correct === "" || l.first_try_correct === null) ? null : truthy(l.first_try_correct), adaptive: String(l.adaptive_reason || ""),
                legacy: l.data_status === "legacy_missing_payload" || (!l.question_text && !l.student_answer)
            };
        }
        function buildAdminData() {
            adminRowsAll = (globalLogs || []).map(normLog);
            const groups = {};
            adminRowsAll.forEach(r => {
                if (r.legacy || r.err === "ERR_INPUT_EMPTY") return;
                const k = [r.uid, r.session, r.stage, r.qid].join("|"); (groups[k] = groups[k] || []).push(r);
            });
            adminQuestions = Object.keys(groups).map(k => {
                const rows = groups[k].sort((a, b) => a.attempt - b.attempt); const f = rows[0]; const okRow = rows.find(r => r.ok);
                const wrongRows = rows.filter(r => !r.ok);
                return {
                    rows: rows, uid: f.uid, username: f.username, nickname: f.nickname, island: f.island, stage: f.stage, op: f.op, template: f.template, diff: f.diff, qid: f.qid, text: f.text,
                    correct: f.correct, firstOk: (okRow && okRow.firstTry !== null) ? (okRow.firstTry === true) : (f.attempt === 1 && f.ok), qtype: f.qtype, two: f.qtype === "two_step", adaptive: (rows.map(r => r.adaptive).filter(Boolean)[0] || ""), attempts: Math.max.apply(null, rows.map(r => r.attempt)), maxHint: Math.max.apply(null, rows.map(r => r.hint)),
                    errs: wrongRows.map(r => r.err).filter(Boolean), wrongAnswers: wrongRows.map(r => r.ans), solved: !!okRow, rt: okRow ? okRow.rt : 0, ts: f.ts
                };
            });
        }

        function questionPasses(q) {
            if (AF.student && q.uid !== AF.student) return false;
            if (AF.island && q.island !== AF.island) return false;
            if (AF.stage && q.stage !== AF.stage) return false;
            if (AF.op && q.op !== AF.op) return false;
            if (AF.err && !q.errs.includes(AF.err)) return false;
            if (AF.hint === "used" && q.maxHint <= 0) return false;
            if (AF.hint === "none" && q.maxHint > 0) return false;
            if (AF.hint === "stuck" && q.maxHint < 3) return false;
            if (AF.from || AF.to) {
                if (!q.ts) return false;
                if (AF.from && q.ts.getTime() < new Date(AF.from + "T00:00:00+08:00").getTime()) return false;
                if (AF.to && q.ts.getTime() > new Date(AF.to + "T23:59:59+08:00").getTime()) return false;
            }
            return true;
        }
        function isDefaultFilter() { return Object.keys(AF).every(k => !AF[k]); }

        function topErr(qs) {
            const c = {}; qs.forEach(q => q.errs.forEach(e => { c[e] = (c[e] || 0) + 1; }));
            const arr = Object.entries(c).sort((a, b) => b[1] - a[1]); return arr.length ? { code: arr[0][0], n: arr[0][1] } : null;
        }
        function stats(qs) {
            const n = qs.length; const first = qs.filter(q => q.firstOk).length; const hinted = qs.filter(q => q.maxHint > 0).length;
            const rts = qs.filter(q => q.rt > 0).map(q => q.rt);
            return {
                n: n, first: first, rate: pct(first, n), hintRate: pct(hinted, n), avgAttempt: n ? qs.reduce((s, q) => s + q.attempts, 0) / n : null,
                avgRt: rts.length ? rts.reduce((s, x) => s + x, 0) / rts.length / 1000 : null, students: new Set(qs.map(q => q.uid)).size, top: topErr(qs)
            };
        }
        function groupBy(qs, keyFn) { const g = {}; qs.forEach(q => { const k = keyFn(q); (g[k] = g[k] || []).push(q); }); return g; }
        function advice(rate) { return rate === null ? "—" : (rate < 60 ? CONCEPT_ADVICE.low : (rate < 80 ? CONCEPT_ADVICE.mid : CONCEPT_ADVICE.high)); }

        // 兩步驟題分析：哪一步卡住、是否單位或合併列式的問題、最近一次的系統調整
        function twoStepSummary(qs) {
            const t = qs.filter(q => q.two); const n = t.length; const cnt = c => t.reduce((s, q) => s + q.errs.filter(e => e === c).length, 0);
            const first = t.filter(q => q.firstOk).length; const adaptive = t.map(q => q.adaptive).filter(Boolean);
            return {
                n: n, rate: pct(first, n), s1op: cnt("ERR_WP_STEP1_OPERATION"), s1calc: cnt("ERR_WP_STEP1_CALC"), s2op: cnt("ERR_WP_STEP2_OPERATION"), s2calc: cnt("ERR_WP_STEP2_CALC"),
                unit: cnt("ERR_WP_UNIT"), expr: cnt("ERR_WP_EXPR_FORMAT"), order: cnt("ERR_WP_COMBINE_ORDER"), last: adaptive.length ? adaptive[adaptive.length - 1] : ""
            };
        }
        function twoStepReasonLabel(c) { return ({ PROMOTE_TWO_STEP: "達門檻，開始出兩步驟題", TWO_STEP_SCHEDULED: "穿插兩步驟題", INTERLEAVE_SINGLE: "穿插單步驟", REMEDIATE_STEP1: "降階補救第一步", REMEDIATE_STEP2: "降階補救第二步", HINT_LEVEL_3: "用到第 3 級提示，降階補救", RETRY_PARALLEL_TWO_STEP: "補救完成，回到平行兩步驟題" })[c] || c || "—"; }
        function twoStepRows(sm) {
            if (!sm.n) return [["兩步驟題數", "0", "尚未出現兩步驟題（單步驟應用題達標後才會出現）"]];
            return [["兩步驟題數", sm.n, "學生實際完成的兩步驟題"], ["首次答對率", pctStr(sm.rate), "整題沒有任何錯誤的比例"],
                ["第一步：方法選錯", sm.s1op, "不知道先求什麼"], ["第一步：計算錯誤", sm.s1calc, "方法對、算錯"], ["第二步：方法選錯", sm.s2op, "第一步對，但不會接著做第二步"], ["第二步：計算錯誤", sm.s2calc, "方法對、算錯"],
                ["單位錯誤", sm.unit, "數字對、單位錯"], ["合併列式：格式／順序錯誤", sm.expr + sm.order, "格式 " + sm.expr + " 次、順序 " + sm.order + " 次"], ["最近一次系統調整", twoStepReasonLabel(sm.last), "自適應出題的依據"]];
        }
        function conceptRows(qs) {
            const g = groupBy(qs, q => q.op);
            return CONCEPT_ORDER.filter(op => g[op]).map(op => {
                const s = stats(g[op]); const lv = {}; for (let d = 1; d <= 4; d++) { const x = g[op].filter(q => q.diff === d); lv[d] = x.length ? pct(x.filter(q => q.firstOk).length, x.length) : null; }
                return { op: op, s: s, lv: lv };
            });
        }
        function typeRows(qs) {
            const g = groupBy(qs, q => q.op + "|" + q.diff);
            return Object.keys(g).map(k => { const arr = g[k]; return { op: arr[0].op, diff: arr[0].diff, s: stats(arr) }; })
                .filter(r => r.s.n >= 3 && r.s.rate !== null && r.s.rate < 100).sort((a, b) => a.s.rate - b.s.rate || b.s.n - a.s.n);
        }
        function questionRows(qs) {
            const g = groupBy(qs, q => q.op + "|" + q.text);
            return Object.keys(g).map(k => {
                const arr = g[k]; const wrong = arr.filter(q => !q.firstOk); const answers = {};
                arr.forEach(q => q.wrongAnswers.forEach(a => { if (a !== undefined && a !== "") answers[a] = (answers[a] || 0) + 1; }));
                const topA = Object.entries(answers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
                return { op: arr[0].op, diff: arr[0].diff, island: arr[0].island, text: arr[0].text, students: new Set(arr.map(q => q.uid)).size, n: arr.length, wrong: wrong.length, rate: pct(wrong.length, arr.length), answers: topA, top: topErr(arr) };
            }).filter(r => r.wrong > 0).sort((a, b) => b.wrong - a.wrong || b.rate - a.rate);
        }
        function errorRows(qs) {
            const c = {};
            qs.forEach(q => q.rows.filter(r => !r.ok && r.err).forEach(r => { const e = c[r.err] = c[r.err] || { code: r.err, n: 0, users: new Set() }; e.n++; e.users.add(q.uid); }));
            return Object.values(c).sort((a, b) => b.n - a.n);
        }

        function applyAdminFilters() {
            AF.from = document.getElementById('f-from').value; AF.to = document.getElementById('f-to').value;
            AF.student = document.getElementById('f-student').value; AF.island = document.getElementById('f-island').value; AF.stage = document.getElementById('f-stage').value;
            AF.op = document.getElementById('f-op').value; AF.err = document.getElementById('f-err').value; AF.hint = document.getElementById('f-hint').value;
            renderAdminAnalytics();
        }
        function resetAdminFilters() {
            AF = { from: "", to: "", student: "", island: "", stage: "", op: "", err: "", hint: "" };
            ['f-from', 'f-to', 'f-student', 'f-island', 'f-stage', 'f-op', 'f-err', 'f-hint'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
            renderAdminAnalytics();
        }
        function buildFilterOptions() {
            const fill = (id, opts) => { const el = document.getElementById(id); const cur = el.value; el.innerHTML = opts.map(o => `<option value="${escapeHTML(o[0])}">${escapeHTML(o[1])}</option>`).join(""); el.value = opts.some(o => o[0] === cur) ? cur : ""; };
            fill('f-student', [["", "全部學生"]].concat(globalUsers.map(u => [String(u.user_id || u.username), `${u.username} ${u.nickname || ""}`.trim()])));
            fill('f-island', [["", "全部島嶼"]].concat(ISLAND_LIST.map(x => [x, x])));
            fill('f-stage', [["", "全部區域"]].concat(Object.keys(ZONE_ZH).map(k => [k, ZONE_ZH[k]])));
            fill('f-op', [["", "全部概念"]].concat(CONCEPT_ORDER.filter(k => k !== "other").map(k => [k, CONCEPT_LABEL[k]])));
            fill('f-err', [["", "全部錯誤"]].concat(Object.keys(ERROR_DICT).filter(k => k !== "ERR_INPUT_EMPTY").map(k => [k, ERROR_DICT[k].label])));
            fill('f-hint', HINT_OPTS);
        }

        function renderAdminAnalytics() {
            adminFiltered = adminQuestions.filter(questionPasses); const all = stats(adminFiltered);
            document.getElementById('filter-note').innerText = isDefaultFilter() ? `目前顯示全部資料，共 ${adminQuestions.length} 題作答。` : `已套用篩選：${adminFiltered.length} / ${adminQuestions.length} 題符合。`;
            document.getElementById('admin-summary').innerHTML =
                `<div class="stat-card">${tIcon('crew', 34)}<span class="stat-label">學生人數</span><div class="value">${all.students}</div></div>` +
                `<div class="stat-card">${tIcon('book', 34)}<span class="stat-label">作答總題數</span><div class="value">${all.n}</div></div>` +
                `<div class="stat-card">${tIcon('check', 34)}<span class="stat-label">全班首次答對率</span><div class="value" style="color:var(--mint-strong);">${pctStr(all.rate)}</div></div>` +
                `<div class="stat-card">${tIcon('hint', 34)}<span class="stat-label">提示使用率</span><div class="value" style="color:var(--gold-strong);">${pctStr(all.hintRate)}</div></div>` +
                `<div class="stat-card">${tIcon('warn', 34)}<span class="stat-label">需要輔導學生人數</span><div class="value" style="color:var(--danger-strong);" id="admin-need-help">${needHelpCount()}</div></div>`;

            const crow = conceptRows(adminFiltered);
            document.getElementById('concept-list').innerHTML = crow.length ? crow.map(r => {
                const te = r.s.top ? `${escapeHTML(errName(r.s.top.code))}（${r.s.top.n}）` : "—";
                return `<tr><td><strong>${escapeHTML(conceptLabel(r.op))}</strong></td><td>${r.s.n}</td><td>${r.s.students}</td><td>${barHTML(r.s.rate)}</td><td>${pctStr(r.s.hintRate)}</td><td>${fmt1(r.s.avgAttempt)}</td>` +
                    [1, 2, 3, 4].map(d => `<td>${pctStr(r.lv[d])}</td>`).join("") + `<td>${te}</td><td style="font-size:0.85rem;">${escapeHTML(advice(r.s.rate))}</td></tr>`;
            }).join("") : '<tr><td colspan="12" style="text-align:center;color:#95a5a6;">目前沒有符合條件的作答資料</td></tr>';

            const trow = typeRows(adminFiltered).slice(0, 10);
            document.getElementById('type-list').innerHTML = trow.length ? trow.map(r =>
                `<tr><td><strong>${escapeHTML(conceptLabel(r.op))}</strong> · 難度 Lv${r.diff || "?"}</td><td>${r.s.n}</td><td>${r.s.students}</td><td>${barHTML(r.s.rate)}</td><td>${fmt1(r.s.avgAttempt)}</td><td>${r.s.top ? escapeHTML(errName(r.s.top.code)) : "—"}</td></tr>`).join("")
                : emptyRow(6, "資料還不夠多（每種題型至少需要 3 題）或全部答對", "check");

            const qrow = questionRows(adminFiltered).slice(0, 15);
            document.getElementById('question-list').innerHTML = qrow.length ? qrow.map(r =>
                `<tr><td style="max-width:360px;">${escapeHTML(r.text)}</td><td>${escapeHTML(conceptLabel(r.op))}${r.diff ? " · Lv" + r.diff : ""}</td><td>${r.students}</td><td>${r.wrong}</td><td>${pctStr(r.rate)}</td><td>${escapeHTML(r.answers.join("、")) || "—"}</td><td>${r.top ? escapeHTML(errName(r.top.code)) : "—"}</td></tr>`).join("")
                : emptyRow(7, "目前沒有答錯的題目", "check");

            const erow = errorRows(adminFiltered); const catCount = {}; erow.forEach(e => { const c = errCatName(e.code) || ERROR_CAT.other; catCount[c] = (catCount[c] || 0) + e.n; });
            document.getElementById('err-chips').innerHTML = Object.keys(catCount).map(c => `<span class="chip">${escapeHTML(c)}：${catCount[c]} 次</span>`).join("") || '<span class="tab-note">目前沒有錯誤紀錄</span>';
            document.getElementById('err-list').innerHTML = erow.length ? erow.map(e =>
                `<tr><td><strong>${escapeHTML(errName(e.code))}</strong><div style="font-size:0.75rem;color:#95a5a6;">${escapeHTML(e.code)}</div></td><td>${escapeHTML(errCatName(e.code))}</td><td>${e.n}</td><td>${e.users.size}</td><td style="font-size:0.9rem;">${escapeHTML(TEACHER_ADVICE[e.code] || "")}</td></tr>`).join("")
                : '<tr><td colspan="5" style="text-align:center;color:#95a5a6;">沒有錯誤紀錄</td></tr>';

            renderStudentTables();
        }

        function weakestConcept(qs) {
            const rows = conceptRows(qs).filter(r => r.s.n >= 3 && r.s.rate !== null).sort((a, b) => a.s.rate - b.s.rate);
            return rows.length && rows[0].s.rate < 80 ? rows[0] : null;
        }
        function stuckInfo(qs) {
            const stuck = qs.filter(q => q.maxHint >= 2).length; const s = stats(qs);
            const reasons = [];
            if (stuck >= 3) reasons.push(`卡關 ${stuck} 題（用到第 2 級以上提示）`);
            if (s.n >= 5 && s.rate !== null && s.rate < 50) reasons.push(`首次答對率僅 ${s.rate}%`);
            return reasons;
        }
        /* 卡關警示的判斷與階段 7 完全相同（stuckInfo）；抽成函式只是為了讓摘要卡片和警示名單用同一份結果 */
        function visibleUsers() { return globalUsers.filter(u => !AF.student || String(u.user_id || u.username) === AF.student); }
        function needHelpCount() {
            const byUser = groupBy(adminFiltered, q => q.uid);
            return visibleUsers().filter(u => stuckInfo(byUser[String(u.user_id || u.username)] || []).length > 0).length;
        }
        /* 最後登入：只認登入時間欄位。last_updated 在存進度時也會更新，不能當成登入時間（舊版會因此顯示成「最近一次存檔」）。沒有登入紀錄就顯示「尚無紀錄」。 */
        function lastLoginText(u) {
            const raw = u.last_login_at ?? u.lastLoginAt ?? u.last_login ?? u.login_time ?? null;
            if (raw === null || raw === undefined || String(raw).trim() === "") return NO_LOGIN_LABEL;
            try {
                const d = new Date(raw); if (isNaN(d.getTime())) return String(raw);
                return taipeiText(d, false);
            } catch (e) { return String(raw); }
        }
        function renderStudentTables() {
            const stuBody = document.getElementById('students-list'); const warnBody = document.getElementById('warning-list'); stuBody.innerHTML = ''; warnBody.innerHTML = '';
            const byUser = groupBy(adminFiltered, q => q.uid); let warnCount = 0;
            visibleUsers().forEach(u => {
                const uid = String(u.user_id || u.username); const qs = byUser[uid] || []; const s = stats(qs);
                const dateStr = lastLoginText(u);
                const wk = weakestConcept(qs);
                stuBody.innerHTML += `<tr><td>${escapeHTML(u.username)}</td><td>${escapeHTML(u.nickname)}</td><td class="td-stars">${tIcon('star', 22)}<b>${u.total_stars || 0}</b></td><td>${s.n}</td><td>${pctStr(s.rate)}</td><td>${pctStr(s.hintRate)}</td><td>${wk ? escapeHTML(conceptLabel(wk.op)) : "—"}</td><td>${escapeHTML(dateStr)}</td><td><button type="button" class="btn-view td-view" data-uid="${escapeHTML(uid)}" onclick="openAdminModal(this.dataset.uid)">${tIcon('chart', 22)}<span>查看分析</span></button></td></tr>`;
                const reasons = stuckInfo(qs);
                if (reasons.length) { warnCount++; warnBody.innerHTML += `<tr><td>${escapeHTML(u.username)}</td><td>${escapeHTML(u.nickname)}</td><td><span class="warning">${tIcon('warn', 20)}<span>${escapeHTML(reasons.join("；"))}</span></span></td><td style="font-size:0.9rem;">${wk ? "建議加強：" + escapeHTML(conceptLabel(wk.op)) : "請個別關心"}</td></tr>`; }
            });
            if (!warnCount) warnBody.innerHTML = emptyRow(4, "目前沒有嚴重卡關的學生！", "check");
        }

        function renderAdminDashboard() {
            switchScreen('screen-admin-dashboard'); buildAdminData(); buildFilterOptions(); applyAdminFilters(); markAdminUpdated(); tHydrate(document);
        }
        /* 「最後更新時間」＝這個畫面最近一次從後台讀到資料的時間（瀏覽器時間，台北時區顯示） */
        function markAdminUpdated() {
            const el = document.getElementById('admin-updated'); if (!el) return;
            let t = ""; try { t = taipeiText(new Date(), true); } catch (e) { t = new Date().toLocaleString(); }
            el.textContent = t; try { el.setAttribute('datetime', new Date().toISOString()); } catch (e) { }
        }

        // ---------- 學生個別報告 ----------
        function openAdminModal(uniqueId) {
            const user = globalUsers.find(u => (String(u.user_id) === uniqueId || u.username === uniqueId)); if (!user) return;
            const uid = String(user.user_id || user.username);
            document.getElementById('admin-modal-name').innerText = `${user.nickname} (${user.username}) 的學習報告`;
            const qs = adminQuestions.filter(q => q.uid === uid || q.username === user.username); const s = stats(qs);
            document.getElementById('admin-modal-total').innerText = s.n; document.getElementById('admin-modal-correct').innerText = pctStr(s.rate === null ? 0 : s.rate);
            document.getElementById('admin-modal-hint').innerText = pctStr(s.hintRate === null ? 0 : s.hintRate); document.getElementById('admin-modal-attempt').innerText = s.n ? fmt1(s.avgAttempt) : "0";

            // 概念掌握
            const crow = conceptRows(qs);
            document.getElementById('admin-modal-concept').innerHTML = crow.length ? crow.map(r => {
                const maxLv = Math.max.apply(null, [0].concat(qs.filter(q => q.op === r.op && q.firstOk).map(q => q.diff)));
                return `<tr><td>${escapeHTML(conceptLabel(r.op))}</td><td>${r.s.n}</td><td>${barHTML(r.s.rate)}</td><td>${maxLv > 0 ? "Lv" + maxLv : "—"}</td></tr>`;
            }).join("") : '<tr><td colspan="4" style="text-align:center;color:#95a5a6;">尚無作答紀錄</td></tr>';

            // 兩步驟題
            document.getElementById('admin-modal-two').innerHTML = twoStepRows(twoStepSummary(qs)).map(r => `<tr><td>${escapeHTML(r[0])}</td><td><strong>${escapeHTML(r[1])}</strong></td><td style="font-size:0.9rem;">${escapeHTML(r[2])}</td></tr>`).join("");

            // 進度
            const progBody = document.getElementById('admin-modal-prog'); progBody.innerHTML = ''; let progressData = {}; try { progressData = typeof user.current_progress === 'string' ? JSON.parse(user.current_progress) : (user.current_progress || {}); } catch (e) { }
            let hasLegacy = adminRowsAll.some(r => (r.uid === uid || r.username === user.username) && r.legacy); let hasProgress = false;
            for (const [island, zones] of Object.entries(progressData || {})) {
                if (!zones || typeof zones !== 'object' || Array.isArray(zones)) continue;
                for (const [zone, records] of Object.entries(zones)) {
                    if (Array.isArray(records) && records.length > 0) {
                        hasProgress = true; const zoneZh = ZONE_ZH[zone] || zone;
                        const bestRecord = records.reduce((best, cur) => { const b = typeof best === 'object' ? (best.stars || 0) : (typeof best === 'number' ? best : 0); const c = typeof cur === 'object' ? (cur.stars || 0) : (typeof cur === 'number' ? cur : 0); return c > b ? cur : best; }, records[0]);
                        const acc = typeof bestRecord === 'object' && bestRecord.accuracy ? bestRecord.accuracy : "--"; const stars = typeof bestRecord === 'object' && bestRecord.stars ? bestRecord.stars : (typeof bestRecord === 'number' ? bestRecord : 0); const date = typeof bestRecord === 'object' && bestRecord.date ? bestRecord.date : "新版紀錄";
                        progBody.innerHTML += `<tr><td>${escapeHTML(island)}</td><td>${escapeHTML(zoneZh)}</td><td>${acc === "--" ? acc : escapeHTML(acc) + "%"}</td><td class="td-stars">${stars > 0 ? starsIcons(Math.min(stars, 3)) : "完成"}</td><td>${escapeHTML(date)}</td></tr>`;
                    }
                }
            }
            if (hasLegacy && !hasProgress) progBody.innerHTML = emptyRow(5, "升級前的舊紀錄！已保留總星數。", "star");
            else if (!hasProgress) progBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#95a5a6;">尚無過關紀錄</td></tr>';

            // 錯誤類型
            const erow = errorRows(qs).slice(0, 5);
            document.getElementById('admin-modal-errs').innerHTML = erow.length ? erow.map(e => `<tr><td><strong>${escapeHTML(errName(e.code))}</strong></td><td>${e.n}</td><td style="font-size:0.9rem;">${escapeHTML(TEACHER_ADVICE[e.code] || "")}</td></tr>`).join("")
                : '<tr><td colspan="3" style="text-align:center; color:#27ae60; font-weight:bold;">沒有錯誤紀錄！</td></tr>';

            // 自動建議
            const wk = weakestConcept(qs); const parts = [];
            if (!s.n) parts.push("目前沒有可分析的作答紀錄。");
            else {
                parts.push(s.rate >= 80 ? "整體首次答對率良好。" : (s.rate >= 60 ? "整體表現尚可，部分概念需要補強。" : "整體首次答對率偏低，建議老師個別輔導。"));
                if (wk) parts.push(`最需要加強的是「${conceptLabel(wk.op)}」（首次答對率 ${wk.s.rate}%）。`);
                if (erow.length) parts.push(`最常見的錯誤是「${errName(erow[0].code)}」：${TEACHER_ADVICE[erow[0].code] || ""}`);
                if (s.hintRate !== null && s.hintRate >= 50) parts.push("超過一半的題目需要提示，可先降低難度、多用實物或圖示練習。");
            }
            document.getElementById('admin-modal-advice').innerText = "老師建議：" + parts.join(" ");

            // 錯題本
            const wrongBody = document.getElementById('admin-modal-wrong-list'); wrongBody.innerHTML = '';
            const wrongRows = adminRowsAll.filter(r => (r.uid === uid || r.username === user.username) && !r.legacy && !r.ok && r.err !== "ERR_INPUT_EMPTY").reverse().slice(0, 20);
            if (wrongRows.length === 0) wrongBody.innerHTML = emptyRow(4, "沒有錯題紀錄！", "check");
            else wrongRows.forEach(r => {
                const textStyle = r.island === "應用題島" ? "font-size:1rem; font-weight:normal;" : "font-size:1.2rem; font-weight:bold; letter-spacing:2px;";
                const diag = plainText(String(r.raw.error_diagnosis || "").split("\n")[0]) || (ERROR_DICT[r.err] ? ERROR_DICT[r.err].label : "單純計算失誤");
                wrongBody.innerHTML += `<tr><td>${escapeHTML(r.island || '未知')}</td><td style="${textStyle}">${escapeHTML(r.text || '?')}</td><td style="color:#e74c3c; font-weight:bold; font-size:1.2rem;">${escapeHTML(r.ans)}</td><td><span style="font-size:0.8rem; color:#7f8c8d;">系統判定：${escapeHTML(errName(r.err))}</span><div class="err-analysis">${tIcon('hint', 20)}<span>${escapeHTML(diag)}</span></div></td></tr>`;
            });
            const mod = document.getElementById('admin-student-modal'); mod.style.display = 'flex'; tHydrate(mod);
            try { const panel = mod.querySelector('.admin-modal-content'); if (panel) panel.scrollTop = 0; adminModalTrigger = document.activeElement; const c = document.getElementById('admin-modal-close'); if (c && c.focus) c.focus({ preventScroll: true }); } catch (e) { }
        }
        let adminModalTrigger = null;
        function closeAdminModal() {
            document.getElementById('admin-student-modal').style.display = 'none';
            try { if (adminModalTrigger && adminModalTrigger.focus && document.contains(adminModalTrigger)) adminModalTrigger.focus({ preventScroll: true }); } catch (e) { } adminModalTrigger = null;
        }
        function starsIcons(n) { try { return UIKit.starsHTML(n, 3); } catch (e) { return String(n); } }

        // ---------- CSV 匯出 ----------
        function csvCell(v) { let str = (v === undefined || v === null) ? "" : String(v); if (/^[=+\-@\t\r]/.test(str)) str = "'" + str; return '"' + str.replace(/"/g, '""') + '"'; }
        function buildCSV(header, rows) { return "﻿" + header.join(",") + "\n" + rows.map(r => r.map(csvCell).join(",")).join("\n") + (rows.length ? "\n" : ""); }
        function downloadCSV(name, content, stamp) {
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); const url = URL.createObjectURL(blob); const timeStr = stamp || new Date().toISOString().slice(0, 10).replace(/-/g, "");
            link.setAttribute("href", url); link.setAttribute("download", `${APP_FILE_PREFIX}_${name}_${timeStr}.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } }, 1000);
        }
        function detailCSV() {
            const userMap = {}; globalUsers.forEach(u => { userMap[String(u.user_id || u.username)] = u.nickname; });
            let rows = [];
            adminFiltered.forEach(q => q.rows.forEach(r => rows.push(r)));
            if (isDefaultFilter()) rows = adminRowsAll.slice();            // 沒篩選時連同舊版紀錄一起匯出
            rows.sort((a, b) => (a.ts ? a.ts.getTime() : 0) - (b.ts ? b.ts.getTime() : 0));
            const header = ["學生帳號", "暱稱", "島嶼", "題型代碼", "題目內容", "學生答案", "正確答案", "是否答對", "錯誤代碼", "使用提示等級", "嘗試次數", "作答時間", "資料狀態", "作答區域", "運算概念", "難度", "錯誤名稱", "錯誤類別", "提示次數", "反應秒數", "題目類型", "步驟數", "學生算式", "整題首答正確", "系統調整原因"];
            const body = rows.map(r => [r.username, r.nickname || userMap[r.uid] || "未知學生", r.island, r.template, r.text, r.ans, r.correct, r.ok ? "是" : "否", r.err, r.hint, r.attempt, r.ts ? r.ts.toLocaleString('zh-TW') : "", r.status || "正常", ZONE_ZH[r.stage] || r.stage, conceptLabel(r.op), r.diff || "", r.ok ? "" : errName(r.err), r.ok ? "" : errCatName(r.err), r.hintsUsed, r.rt ? Math.round(r.rt / 100) / 10 : "", r.qtype === "two_step" ? "兩步驟" : (r.qtype === "single_step" ? "單步驟應用題" : (r.qtype === "basic" ? "基礎題" : "")), r.qtype ? r.stepCount : "", r.studentExpr, r.firstTry === null ? "" : (r.firstTry ? "是" : "否"), twoStepReasonLabel(r.adaptive) === "—" ? "" : twoStepReasonLabel(r.adaptive)]);
            return buildCSV(header, body);
        }
        function conceptCSV() {
            const header = ["運算概念", "作答題數", "學生數", "首次答對率(%)", "提示使用率(%)", "平均嘗試次數", "平均反應秒數", "Lv1首次答對率(%)", "Lv2首次答對率(%)", "Lv3首次答對率(%)", "Lv4首次答對率(%)", "最常見錯誤代碼", "最常見錯誤名稱", "教學建議"];
            return buildCSV(header, conceptRows(adminFiltered).map(r => [conceptLabel(r.op), r.s.n, r.s.students, r.s.rate ?? "", r.s.hintRate ?? "", fmt1(r.s.avgAttempt) === "—" ? "" : fmt1(r.s.avgAttempt), fmt1(r.s.avgRt) === "—" ? "" : fmt1(r.s.avgRt), r.lv[1] ?? "", r.lv[2] ?? "", r.lv[3] ?? "", r.lv[4] ?? "", r.s.top ? r.s.top.code : "", r.s.top ? errName(r.s.top.code) : "", advice(r.s.rate)]));
        }
        function errorProneCSV() {
            const header = ["分析層級", "運算概念", "島嶼", "難度", "題型／題目", "作答題數", "作答學生數", "首次答錯題數", "首次答對率(%)", "最常見錯誤代碼", "最常見錯誤名稱", "常見錯誤答案"];
            const rows = [];
            typeRows(adminFiltered).forEach(r => rows.push(["題型", conceptLabel(r.op), "", r.diff || "", `${conceptLabel(r.op)} Lv${r.diff || "?"}`, r.s.n, r.s.students, r.s.n - r.s.first, r.s.rate ?? "", r.s.top ? r.s.top.code : "", r.s.top ? errName(r.s.top.code) : "", ""]));
            questionRows(adminFiltered).forEach(r => rows.push(["題目", conceptLabel(r.op), r.island, r.diff || "", r.text, r.n, r.students, r.wrong, 100 - r.rate, r.top ? r.top.code : "", r.top ? errName(r.top.code) : "", r.answers.join("、")]));
            return buildCSV(header, rows);
        }
        function summaryCSV() {
            const header = ["學生帳號", "暱稱", "總星數", "作答題數", "首次答對率(%)", "提示使用率(%)", "平均嘗試次數", "最弱概念", "最常見錯誤代碼", "最常見錯誤名稱"].concat(SUMMARY_CONCEPTS.map(k => conceptLabel(k) + "首次答對率(%)"));
            const byUser = groupBy(adminFiltered, q => q.uid);
            const rows = globalUsers.filter(u => !AF.student || String(u.user_id || u.username) === AF.student).map(u => {
                const qs = byUser[String(u.user_id || u.username)] || []; const s = stats(qs); const wk = weakestConcept(qs); const g = groupBy(qs, q => q.op);
                return [u.username, u.nickname, u.total_stars || 0, s.n, s.rate ?? "", s.hintRate ?? "", fmt1(s.avgAttempt) === "—" ? "" : fmt1(s.avgAttempt), wk ? conceptLabel(wk.op) : "", s.top ? s.top.code : "", s.top ? errName(s.top.code) : ""]
                    .concat(SUMMARY_CONCEPTS.map(k => g[k] ? (pct(g[k].filter(q => q.firstOk).length, g[k].length) ?? "") : ""));
            });
            return buildCSV(header, rows);
        }
        /* ---------- 匯出「全部」作答紀錄（階段 8）：不看篩選條件，全部學生、全部紀錄（含舊版）。只用畫面上已經載入的 globalLogs/globalUsers，不再呼叫後端、不寫入任何資料。 ---------- */
        const FULL_CSV_HEADER = ["學生帳號", "學生暱稱", "user_id", "作答時間", "島嶼", "學習區域", "題目內容", "學生答案", "正確答案", "是否答對", "運算類型", "難度", "題型", "錯誤代碼", "錯誤診斷", "提示等級", "提示使用情況", "作答時間長度", "session_id", "template_id", "log_id",
            /* 以下是「逐題明細」原有、但上面名稱不同或沒有的欄位，原樣保留（舊的試算表／樞紐分析用原名稱也找得到） */
            "暱稱", "題型代碼", "嘗試次數", "資料狀態", "作答區域", "運算概念", "錯誤名稱", "錯誤類別", "使用提示等級", "提示次數", "反應秒數", "題目類型", "步驟數", "學生算式", "整題首答正確", "系統調整原因"];
        function fullTimeText(r) {
            if (r.ts) { try { return taipeiText(r.ts, true); } catch (e) { return r.ts.toISOString(); } }
            return String(r.raw.answered_at || r.raw.timestamp || "");
        }
        function fullCSV() {
            const userMap = {}; (globalUsers || []).forEach(u => { userMap[String(u.user_id || u.username)] = u; });
            const idx = new Map(); adminRowsAll.forEach((r, i) => idx.set(r, i));
            const rows = adminRowsAll.slice().sort((a, b) => ((a.ts ? a.ts.getTime() : 0) - (b.ts ? b.ts.getTime() : 0)) || (idx.get(a) - idx.get(b)));
            const L = LEGACY_LABEL;
            const body = rows.map(r => {
                const u = userMap[r.uid] || {}; const raw = r.raw; const legacy = !!r.legacy;
                const miss = v => (v === undefined || v === null || v === "");
                const fill = v => (miss(v) ? (legacy ? L : "") : v);                                        // 舊版紀錄沒有保存的欄位：標示出來，不編造內容
                const okRaw = raw.is_correct; const okText = miss(okRaw) ? (legacy ? L : "") : (r.ok ? "是" : "否");
                const diagRaw = String(raw.error_diagnosis || "");
                const diag = r.ok ? "" : (diagRaw || (r.err ? errName(r.err) : ""));
                const hintUse = (r.hint > 0 || r.hintsUsed > 0) ? ("最高第 " + r.hint + " 級；共使用 " + r.hintsUsed + " 次") : (legacy && miss(raw.hint_level) ? L : "未使用提示");
                const qtypeText = r.qtype === "two_step" ? "兩步驟" : (r.qtype === "single_step" ? "單步驟應用題" : (r.qtype === "basic" ? "基礎題" : ""));
                const nick = r.nickname || u.nickname || "未知學生";
                return [r.username || u.username || "", nick, raw.user_id !== undefined && raw.user_id !== null ? raw.user_id : (u.user_id || ""), fullTimeText(r), r.island, ZONE_ZH[r.stage] || r.stage, fill(r.text), fill(r.ans), fill(r.correct), okText, conceptLabel(r.op), r.diff || "", qtypeText, r.err, diag, r.hint, hintUse, r.rt ? Math.round(r.rt / 100) / 10 : "", r.session, r.template, raw.log_id !== undefined && raw.log_id !== null ? raw.log_id : "",
                    nick, r.template, r.attempt, r.status || "正常", ZONE_ZH[r.stage] || r.stage, conceptLabel(r.op), r.ok ? "" : errName(r.err), r.ok ? "" : errCatName(r.err), r.hint, r.hintsUsed, r.rt ? Math.round(r.rt / 100) / 10 : "", qtypeText, r.qtype ? r.stepCount : "", r.studentExpr, r.firstTry === null ? "" : (r.firstTry ? "是" : "否"), twoStepReasonLabel(r.adaptive) === "—" ? "" : twoStepReasonLabel(r.adaptive)];
            });
            return buildCSV(FULL_CSV_HEADER, body);
        }
        function exportStamp(d) { const p = n => String(n).padStart(2, "0"); d = d || new Date(); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
        function setExportStatus(msg) { const el = document.getElementById('export-status'); if (el) el.textContent = msg; }
        function exportAllCSV() {
            if (!adminRowsAll.length) { setExportStatus("目前沒有任何作答紀錄可以匯出。"); return; }
            downloadCSV("全部作答紀錄", fullCSV(), exportStamp());
            setExportStatus("已匯出全部作答紀錄，共 " + adminRowsAll.length + " 筆（不受篩選影響）。");
        }
        function exportDetailCSV() { if (!adminRowsAll.length) return alert("目前沒有作答明細可匯出！"); downloadCSV("作答明細", detailCSV()); }
        function exportConceptCSV() { if (!adminFiltered.length) return alert("目前沒有資料可匯出！"); downloadCSV("概念分析", conceptCSV()); }
        function exportErrorProneCSV() { if (!adminFiltered.length) return alert("目前沒有資料可匯出！"); downloadCSV("易錯題", errorProneCSV()); }
        function exportSummaryCSV() { if (!globalUsers.length) return alert("目前沒有學生資料可匯出！"); downloadCSV("全班摘要", summaryCSV()); }

        // ---------- 登入 / 重新整理 ----------
        /* 階段 9B-1：管理員改用「登入換 token」。密碼只在登入那一次送出，之後只送 token（放記憶體，2 小時到期）。
           若後端還是舊版（沒有 admin_login），自動退回舊的 get_admin_data（過渡期相容）。 */
        let adminMode = 'none';   // 'token'：新版；'legacy'：舊版後端相容

        /* 分頁讀取全部資料（Learning_Logs 可能有十萬筆以上，後端每頁最多 2 萬筆） */
        async function adminFetchAll() {
            let off = 0, users = null, logs = [];
            for (let i = 0; i < 400; i++) {
                const res = await apiCall({ action: 'admin_get_data', token: AuthSession.admin.token, logs_offset: off });
                if (res.status !== 'success') return res;
                if (res.users) users = res.users;
                logs = logs.concat(res.logs || []);
                if (res.next_offset === null || res.next_offset === undefined) break;
                off = res.next_offset;
            }
            return { status: 'success', users: users || [], logs: logs };
        }

        function adminSessionExpired() {
            AuthSession.admin = null; adminMode = 'none'; Loading.hide();
            document.getElementById('admin-error-msg').innerText = '登入已逾時（管理員登入 2 小時後自動結束），請重新登入。';
            switchScreen('screen-admin-login');
        }

        function adminErrText(res) {
            if (res.code === 'ADMIN_NOT_CONFIGURED') return res.message;           // 「系統尚未完成管理員設定」
            if (res.code === 'LOCKED') return res.message;
            return '無法登入：' + res.message;
        }

        async function doAdminAuth() {
            const pwd = document.getElementById('admin-pwd').value; if (!pwd) { alert("請輸入管理員密碼！"); return; }
            document.getElementById('admin-error-msg').innerText = ""; if (GAS_URL.includes("請換成")) { enableDemoMode(); return; }
            if (Loading.busy) return;   /* 正在同步時不重複送出 */
            Loading.show();
            try {
                const res = await apiCall({ action: 'admin_login', password: pwd });
                if (res.status === 'success' && res.token) {
                    AuthSession.admin = { token: res.token, expires_at: res.expires_at }; adminMode = 'token';
                    document.getElementById('admin-pwd').value = '';                   // 登入後不再把密碼留在輸入框
                    Loading.hide();
                    /* 階段 10：登入後進入「管理員中心」，不預先下載學習紀錄；舊儀表板要到「資料匯出中心」按下才載入 */
                    if (typeof AdminCenter !== 'undefined') { AdminCenter.open(); return; }
                    const data = await adminFetchAll();
                    if (data.status !== 'success') { AuthSession.admin = null; adminMode = 'none'; document.getElementById('admin-error-msg').innerText = "無法載入資料：" + data.message; return; }
                    globalUsers = data.users; globalLogs = data.logs; renderAdminDashboard();
                    return;
                }
                if (res.status === 'error' && (res.code === 'UNKNOWN_ACTION' || res.code === 'SCHEMA_NOT_READY')) {      // 舊版後端、或新版後端還沒建立階段 9 資料表（過渡期）：沿用 get_admin_data
                    adminMode = 'legacy'; { const bb = document.getElementById('btn-admin-center-back'); if (bb) bb.hidden = true; }
                    const old = await apiCall({ action: 'get_admin_data', password: pwd }); Loading.hide();
                    if (old.status === 'error') { document.getElementById('admin-error-msg').innerText = adminErrText(old); return; }
                    globalUsers = old.users || []; globalLogs = old.logs || []; renderAdminDashboard();
                    if (typeof AdminTeachers !== 'undefined') AdminTeachers.leave();
                    if (old.using_default_password) alert('注意：後台還在使用預設教師密碼，請到 Apps Script 執行 setAdminPasswordNow 更換。');
                    return;
                }
                Loading.hide();
                if (res.status === 'error') { document.getElementById('admin-error-msg').innerText = adminErrText(res); return; }
                document.getElementById('admin-error-msg').innerText = "無法登入，請稍後再試。";
            } catch (err) { console.error(err); Loading.hide(); document.getElementById('admin-error-msg').innerHTML = `連線失敗，請檢查網址或網路！<br><br><button onclick="enableDemoMode()" class="btn-game btn-primary" style="margin-top:10px;">開啟畢展展示模式</button>`; }
            finally { Loading.hide(); }   /* 任何分支都會關閉救生圈 */
        }

        /* 階段 10：從「資料匯出中心 → 學習紀錄分析（進階）」才載入舊版儀表板（原本的全量讀取，後端權限限制不變） */
        async function openLegacyDashboard() {
            if (adminMode !== 'token' || !AuthSession.admin) { adminSessionExpired(); return; }
            if (Loading.busy) return;
            Loading.show();
            try {
                const data = await adminFetchAll();
                if (data.code === 'SESSION_INVALID') { adminSessionExpired(); return; }
                if (data.status !== 'success') {
                    const m = document.getElementById('ac-legacy-msg'); const t = '無法載入學習紀錄分析：' + (data.message || '請稍後再試');
                    if (m) m.textContent = t; else alert(t); return;
                }
                globalUsers = data.users; globalLogs = data.logs; renderAdminDashboard();
                const bb = document.getElementById('btn-admin-center-back'); if (bb) bb.hidden = false;
                switchScreen('screen-admin-dashboard');
            } catch (e) { console.error(e); alert('連線失敗，請檢查網路後再試一次。'); }
            finally { Loading.hide(); }
        }

        async function refreshAdminData() {
            if (GAS_URL.includes("請換成")) return;
            if (adminMode === 'token' && !AuthSession.admin) return;
            const legacyPwd = document.getElementById('admin-pwd').value; if (adminMode !== 'token' && !legacyPwd) return;
            if (Loading.busy) return;   /* 正在同步時不重複送出（階段 8.1：重新整理也使用救生圈載入畫面） */
            const btn = document.getElementById('btn-admin-refresh'); const btnHTML = btn.innerHTML; btn.innerText = "更新中…"; btn.disabled = true;
            Loading.show();
            try {
                const data = adminMode === 'token' ? await adminFetchAll() : await apiCall({ action: 'get_admin_data', password: legacyPwd });
                if (data.status === 'success') { globalUsers = data.users || []; globalLogs = data.logs || []; renderAdminDashboard(); }
                else if (data.code === 'SESSION_INVALID') adminSessionExpired();
            } catch (error) { console.error(error); } finally { Loading.hide(); btn.innerHTML = btnHTML; btn.disabled = false; }   /* 成功、後端錯誤、斷網、例外都會關閉救生圈並還原按鈕 */
        }

        // 展示模式：用真正的題庫引擎產生模擬資料（不同程度的學生、各種錯誤）
        function enableDemoMode() {
            Loading.hide(); document.getElementById('dashboard-title-text').innerText = "班級學習分析儀表板（展示模式）";
            const profiles = [
                { id: "USR_01", username: "S01", nickname: "王小明", skill: 0.9 }, { id: "USR_02", username: "S02", nickname: "林小美", skill: 0.75 },
                { id: "USR_03", username: "S03", nickname: "陳大雄", skill: 0.5 }, { id: "USR_04", username: "S04", nickname: "張小語", skill: 0.35 }
            ];
            const zones = ["LEARNING", "PRACTICE", "MASTERY"]; const islands = [["加法島", "add"], ["減法島", "sub"], ["乘法島", "mul"], ["除法島", "div"], ["應用題島", "wp"], ["四則運算島", "order"]];
            const users = [], logs = []; let seq = 0; const now = Date.now();
            profiles.forEach((p, pi) => {
                users.push({ user_id: p.id, username: p.username, nickname: p.nickname, total_stars: Math.round(p.skill * 20), last_login_at: new Date(now - pi * 3600000).toISOString(), current_progress: JSON.stringify({ "加法島": { LEARNING: [{ stars: p.skill > 0.6 ? 3 : 2, accuracy: Math.round(p.skill * 100), date: "10/25 10:00" }] } }) });
                for (let n = 0; n < 40; n++) {
                    const [island, key] = islands[Math.floor(Math.random() * islands.length)]; const zone = zones[Math.floor(Math.random() * 3)];
                    if (key === "wp" && zone !== "LEARNING" && Math.random() < 0.4) {       // 展示用：兩步驟應用題（含第幾步卡住、單位錯誤、首答是否正確）
                        const q2 = TwoStepEngine.generate(1 + Math.floor(Math.random() * 3)); if (q2) {
                            const sess2 = "SES_" + p.id + "_" + Math.floor(n / 10); const ts2 = new Date(now - (profiles.length - pi) * 600000 - (40 - n) * 60000).toISOString(); let w = 0; const codes = ["ERR_WP_STEP1_OPERATION", "ERR_WP_STEP1_CALC", "ERR_WP_STEP2_OPERATION", "ERR_WP_STEP2_CALC", "ERR_WP_UNIT"];
                            const base = { user_id: p.id, username: p.username, nickname_snapshot: p.nickname, session_id: sess2, island: island, stage: zone, operation: "wp2", question_id: q2.fingerprint, template_id: q2.template_id, difficulty: q2.level, question_text: "[兩步驟應用題] " + q2.expression, expression: q2.expression, correct_answer: q2.correctAnswer, answered_at: ts2, data_status: "", question_type: "two_step", step_count: 2 };
                            while (w < 3 && Math.random() > Math.min(0.95, p.skill - 0.1 + w * 0.2)) { w++; logs.push(Object.assign({}, base, { log_id: "DEMO_" + (++seq), student_answer: String(q2.correctAnswer + w), student_expression: q2.steps[1].expr, is_correct: false, error_code: MathEngineV2.pick(codes), hint_level: w, hints_used: w, response_time_ms: 6000 + Math.floor(Math.random() * 15000), attempt_number: w, first_try_correct: false, adaptive_reason: "" })); }
                            logs.push(Object.assign({}, base, { log_id: "DEMO_" + (++seq), student_answer: String(q2.correctAnswer), student_expression: q2.steps[1].expr + " = " + q2.correctAnswer, is_correct: true, error_code: "CORRECT", hint_level: 0, hints_used: w, response_time_ms: 9000 + Math.floor(Math.random() * 25000), attempt_number: w + 2, first_try_correct: w === 0, adaptive_reason: w === 0 ? "TWO_STEP_SCHEDULED" : (w >= 3 ? "HINT_LEVEL_3" : "REMEDIATE_STEP2") })); continue;
                        }
                    }
                    const wpOp = key === "wp" ? MathEngineV2.pick(["+", "-", "*", "/"]) : null; const lv = Math.min(MathEngineV2.maxLv[island], 1 + Math.floor(Math.random() * (zone === "LEARNING" ? 2 : 3)));
                    const q = MathEngineV2.generateQuestion(island, lv, wpOp);
                    const difficulty = (key === "order" ? 0.15 : (key === "div" || key === "wp" ? 0.08 : 0)) + (lv - 1) * 0.08;
                    const sess = "SES_" + p.id + "_" + Math.floor(n / 10); const ts = new Date(now - (profiles.length - pi) * 600000 - (40 - n) * 60000).toISOString(); const qid = q.fingerprint; let attempts = 0, solved = false;
                    while (!solved && attempts < 4) {
                        attempts++; const good = Math.random() < Math.min(0.97, Math.max(0.1, p.skill - difficulty + (attempts - 1) * 0.25)); let ans = q.correctAnswer, code = "CORRECT", opSym = q.isWord ? q.params.op : null;
                        if (!good) {
                            const mis = Object.entries(q.misconceptions); if (q.isWord && Math.random() < 0.6) { opSym = MathEngineV2.pick(["+", "-", "*", "/"].filter(o => o !== q.params.op)); ans = q.correctAnswer; }
                            else if (mis.length && Math.random() < 0.6) { const m = MathEngineV2.pick(mis); ans = m[1]; } else ans = q.correctAnswer + MathEngineV2.pick([-10, -1, 1, 2, 10]);
                            const d = MathEngineV2.diagnoseError(q, opSym, String(ans)); code = d.errorCode; if (d.isCorrect) { solved = true; code = "CORRECT"; }
                        } else solved = true;
                        const hintLvl = solved ? 0 : Math.min(attempts, 3); const shown = q.isWord ? `${q.params.a} ${OP_SYM[opSym || q.params.op]} ${q.params.b} = ${ans}` : String(ans);
                        logs.push({ log_id: "DEMO_" + (++seq), user_id: p.id, username: p.username, nickname_snapshot: p.nickname, session_id: sess, island: island, stage: zone, operation: q.operation, question_id: qid, template_id: q.template_id, difficulty: q.level, question_text: q.isWord ? "[應用題] " + q.expression : q.expression, expression: q.expression, correct_answer: q.correctAnswer, student_answer: shown, is_correct: solved, error_code: solved ? "CORRECT" : code, hint_level: hintLvl, hints_used: Math.max(0, attempts - (solved ? 1 : 0)), response_time_ms: 4000 + Math.floor(Math.random() * 12000), attempt_number: attempts, answered_at: ts, data_status: "" });
                    }
                }
            });
            globalUsers = users; globalLogs = logs; renderAdminDashboard();
        }
    