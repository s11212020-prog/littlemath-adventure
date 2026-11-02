/* 兩步驟應用題：設定、題庫、驗證、策略、介面 */
        // ==========================================================================
        const TWO_STEP_CONFIG = {
            minSingleDone: 6,          // 至少完成幾題單步驟應用題才可能升階
            window: 8,                 // 計算第一答正確率的最近題數（不足就用現有題數，至少 minSingleDone）
            minFirstTryRate: 0.85,     // 最近題目的第一答正確率門檻
            lastNAllFirstTry: 3,       // 最近 N 題都必須第一答正確
            hintWindow: 6, maxAvgHints: 0.5,   // 最近 6 題平均提示量上限
            opUsableWindow: 12,        // 判斷某個運算「已可用」時回看的題數
            ratios: [0.2, 0.4, 0.6],   // 兩步驟題比例（第一次達門檻 20%，連續答對後逐步提高）
            advanceAfterOk: 2,         // 連續幾題兩步驟「第一答正確」才提高比例
            maxConsecutiveTwo: 2,      // 不得連續超過幾題兩步驟
            demoteWindow: 3, demoteWrong: 2,   // 最近 3 題錯 2 題 → 降回單步驟
            remedialSingles: 2,        // 補救：連續完成幾題對應的單步驟平行題後，再回到兩步驟
            zones: ['PRACTICE', 'MASTERY'],    // 學習區只有 3 題，不出兩步驟
            mergedAfterOk: 2           // 連續幾題兩步驟第一答正確後，改用「合併列式」
        };

        const TWO_STEP_TEMPLATES = {
            WP2_ADD_SUB: { ops: ['+', '-'], expr: p => `${p.a} + ${p.b} - ${p.c}`, merged: p => `(${p.a} + ${p.b}) - ${p.c}`, nums: p => [p.a, p.b, p.c], r1: p => p.a + p.b, ans: p => p.a + p.b - p.c, x2: p => [p.a + p.b, p.c], x1: p => [p.a, p.b],
                stories: [
                    { t: "{n}有 {a} {u}{i}，又拿到 {b} {u}，後來送給朋友 {c} {u}，{n}現在還有幾{u}{i}？", ask1: "拿到之後，{n}一共有幾{u}{i}？", k: ["又拿到", "送給", "還有"] },
                    { t: "圖書角原本有 {a} 本書，今天又買來 {b} 本，同學借走了 {c} 本，現在圖書角還有幾本書？", ask1: "買來之後，圖書角一共有幾本書？", k: ["又買來", "借走了", "還有"], unit: "本", plain: true }] },
            WP2_SUB_ADD: { ops: ['-', '+'], expr: p => `${p.a} - ${p.b} + ${p.c}`, merged: p => `(${p.a} - ${p.b}) + ${p.c}`, nums: p => [p.a, p.b, p.c], r1: p => p.a - p.b, ans: p => p.a - p.b + p.c, x2: p => [p.a - p.b, p.c], x1: p => [p.a, p.b],
                stories: [
                    { t: "{n}有 {a} {u}{i}，用掉了 {b} {u}，後來媽媽又給了 {c} {u}，現在{n}共有幾{u}{i}？", ask1: "用掉之後，{n}還剩下幾{u}{i}？", k: ["用掉了", "又給了", "共有"] },
                    { t: "盒子裡有 {a} {u}{i}，拿出 {b} {u}之後，又放回 {c} {u}，盒子裡現在有幾{u}{i}？", ask1: "拿出之後，盒子裡還剩下幾{u}{i}？", k: ["拿出", "又放回", "現在有"] }] },
            WP2_MUL_ADD: { ops: ['*', '+'], expr: p => `${p.a} * ${p.b} + ${p.c}`, merged: p => `${p.a} × ${p.b} + ${p.c}`, nums: p => [p.a, p.b, p.c], r1: p => p.a * p.b, ans: p => p.a * p.b + p.c, x2: p => [p.a * p.b, p.c], x1: p => [p.a, p.b],
                stories: [
                    { t: "每個盒子裝 {a} {u}{i}，{n}買了 {b} 盒，另外還有散裝的 {c} {u}，一共有幾{u}{i}？", ask1: "{b} 盒一共有幾{u}{i}？", k: ["每個盒子", "另外還有", "一共"] },
                    { t: "每排放 {a} {u}{i}，放了 {b} 排，旁邊再放 {c} {u}，總共有幾{u}{i}？", ask1: "{b} 排一共有幾{u}{i}？", k: ["每排", "再放", "總共"] }] },
            WP2_MUL_SUB: { ops: ['*', '-'], expr: p => `${p.a} * ${p.b} - ${p.c}`, merged: p => `${p.a} × ${p.b} - ${p.c}`, nums: p => [p.a, p.b, p.c], r1: p => p.a * p.b, ans: p => p.a * p.b - p.c, x2: p => [p.a * p.b, p.c], x1: p => [p.a, p.b],
                stories: [
                    { t: "每盒有 {a} {u}{i}，{n}有 {b} 盒，分給同學 {c} {u}後，還剩下幾{u}{i}？", ask1: "{b} 盒一共有幾{u}{i}？", k: ["每盒", "分給", "還剩下"] },
                    { t: "每袋裝 {a} {u}{i}，做了 {b} 袋，賣出 {c} {u}，還剩幾{u}{i}？", ask1: "{b} 袋一共有幾{u}{i}？", k: ["每袋", "賣出", "還剩"] }] },
            WP2_ADD_DIV: { ops: ['+', '/'], expr: p => `(${p.a} + ${p.b}) / ${p.c}`, merged: p => `(${p.a} + ${p.b}) ÷ ${p.c}`, nums: p => [p.a, p.b, p.c], r1: p => p.a + p.b, ans: p => (p.a + p.b) / p.c, x2: p => [p.a + p.b, p.c], x1: p => [p.a, p.b],
                stories: [
                    { t: "{n}有 {a} {u}{i}，{n2}有 {b} {u}{i}，兩人把{i}合起來平分給 {c} 個小朋友，每人分到幾{u}？", ask1: "兩人合起來共有幾{u}{i}？", k: ["合起來", "平分給", "每人分到"] },
                    { t: "第一箱有 {a} {u}{i}，第二箱有 {b} {u}，全部平均裝成 {c} 袋，每袋有幾{u}？", ask1: "兩箱一共有幾{u}{i}？", k: ["全部", "平均裝成", "每袋有"] }] },
            WP2_SUB_DIV: { ops: ['-', '/'], expr: p => `(${p.a} - ${p.b}) / ${p.c}`, merged: p => `(${p.a} - ${p.b}) ÷ ${p.c}`, nums: p => [p.a, p.b, p.c], r1: p => p.a - p.b, ans: p => (p.a - p.b) / p.c, x2: p => [p.a - p.b, p.c], x1: p => [p.a, p.b],
                stories: [
                    { t: "有 {a} {u}{i}，先留下 {b} {u}，其餘的平均分給 {c} 個人，每人分到幾{u}？", ask1: "留下之後，剩下幾{u}{i}？", k: ["先留下", "其餘的平均分給", "每人分到"] },
                    { t: "老師準備了 {a} {u}{i}，用掉 {b} {u}之後，把剩下的平均裝成 {c} 盒，每盒裝幾{u}？", ask1: "用掉之後，剩下幾{u}{i}？", k: ["用掉", "剩下的平均裝成", "每盒裝"] }] },
            WP2_DIV_ADD: { ops: ['/', '+'], expr: p => `${p.a} / ${p.b} + ${p.c}`, merged: p => `${p.a} ÷ ${p.b} + ${p.c}`, nums: p => [p.a, p.b, p.c], r1: p => p.a / p.b, ans: p => p.a / p.b + p.c, x2: p => [p.a / p.b, p.c], x1: p => [p.a, p.b],
                stories: [
                    { t: "{a} {u}{i}平均放進 {b} 個盒子，每個盒子後來又多放 {c} {u}，現在每個盒子有幾{u}{i}？", ask1: "平均放進之後，每個盒子有幾{u}{i}？", k: ["平均放進", "又多放", "每個盒子"] },
                    { t: "{n}把 {a} {u}{i}平均分給 {b} 位同學，每位同學後來又多拿了 {c} {u}，每位同學現在有幾{u}？", ask1: "平均分給之後，每位同學分到幾{u}？", k: ["平均分給", "又多拿了", "現在有"] }] },
            WP2_MUL_DIV: { ops: ['*', '/'], expr: p => `(${p.a} * ${p.b}) / ${p.c}`, merged: p => `(${p.a} × ${p.b}) ÷ ${p.c}`, nums: p => [p.a, p.b, p.c], r1: p => p.a * p.b, ans: p => (p.a * p.b) / p.c, x2: p => [p.a * p.b, p.c], x1: p => [p.a, p.b],
                stories: [
                    { t: "每盒有 {a} {u}{i}，共有 {b} 盒，把全部的{i}平均分給 {c} 個人，每人分到幾{u}？", ask1: "{b} 盒一共有幾{u}{i}？", k: ["每盒", "平均分給", "每人分到"] },
                    { t: "每排有 {a} 個座位，有 {b} 排，把全部座位平均分成 {c} 區，每區有幾個座位？", ask1: "{b} 排一共有幾個座位？", k: ["每排", "平均分成", "每區有"], unit: "個", plain: true }] }
        };
        const TWO_STEP_IDS = Object.keys(TWO_STEP_TEMPLATES);
        const UNIT_POOL = ['顆', '個', '本', '張', '枝', '塊', '人', '盒', '袋', '輛'];

        // ---------- 表達式解析（不使用 eval）：數字、＋－×÷、圓括號 ----------
        const ExprParser = {
            normalize: function (s) {
                let t = String(s == null ? '' : s).replace(/[＋]/g, '+').replace(/[－−–—]/g, '-').replace(/[×✖xX＊*]/g, '*').replace(/[÷➗／/]/g, '/').replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
                t = t.split(/[=＝]/)[0]; return t.replace(/\s+/g, '');
            },
            // 回傳 { ok, value, nums:[...], ops:[...] }；格式錯誤 ok=false
            parse: function (s) {
                const t = this.normalize(s); if (!t || !/^[0-9+\-*/().]+$/.test(t)) return { ok: false };
                let i = 0; const nums = [], ops = [];
                const peek = () => t[i];
                function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = t[i++]; ops.push(o); const r = term(); v = o === '+' ? v + r : v - r; } return v; }
                function term() { let v = factor(); while (peek() === '*' || peek() === '/') { const o = t[i++]; ops.push(o); const r = factor(); if (o === '/' && r === 0) throw new Error('div0'); v = o === '*' ? v * r : v / r; } return v; }
                function factor() {
                    if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw new Error('paren'); i++; return v; }
                    const m = /^[0-9]+/.exec(t.slice(i)); if (!m) throw new Error('num'); i += m[0].length; if (t[i] === '.') throw new Error('dec'); const n = parseInt(m[0], 10); nums.push(n); return n;
                }
                try { const v = expr(); if (i !== t.length) return { ok: false }; return { ok: true, value: v, nums: nums, ops: ops }; } catch (e) { return { ok: false }; }
            }
        };

        const TwoStepEngine = {
            ri: function (a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
            pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
            // 先產生數學結構（a,b,c），再套故事
            genNumbers: function (id, tier) {
                const ri = this.ri.bind(this); const T = Math.max(1, Math.min(3, tier || 1)); let a, b, c;
                switch (id) {
                    case 'WP2_ADD_SUB':
                        if (T === 1) { a = ri(3, 12); b = ri(2, 20 - a); } else if (T === 2) { a = ri(10, 60); b = ri(5, 100 - a); } else { a = ri(100, 600); b = ri(20, Math.min(399, 1000 - a)); }
                        c = ri(1, Math.min(a + b - 1, T === 1 ? 20 : (T === 2 ? 60 : 500))); if (T === 3) c = Math.max(c, Math.min(10, a + b - 1)); break;
                    case 'WP2_SUB_ADD':
                        if (T === 1) { a = ri(6, 20); b = ri(1, a - 1); c = ri(1, 20 - (a - b)); } else if (T === 2) { a = ri(20, 90); b = ri(5, a - 5); c = ri(1, Math.min(60, 100 - (a - b))); } else { a = ri(200, 900); b = ri(50, Math.min(600, a - 50)); c = ri(20, Math.min(400, 1000 - (a - b))); } break;
                    case 'WP2_MUL_ADD':
                        if (T === 1) { a = ri(2, 5); b = ri(2, 5); c = ri(1, 9); } else if (T === 2) { a = ri(2, 9); b = ri(2, 9); c = ri(1, 20); } else { a = ri(6, 9); b = ri(6, 9); c = ri(10, 100); } break;
                    case 'WP2_MUL_SUB':
                        if (T === 1) { a = ri(3, 5); b = ri(2, 5); c = ri(1, Math.min(9, a * b - 1)); } else if (T === 2) { a = ri(3, 9); b = ri(3, 9); c = ri(1, Math.min(40, a * b - 1)); } else { a = ri(6, 9); b = ri(6, 9); c = ri(5, Math.min(60, a * b - 1)); } break;
                    case 'WP2_ADD_DIV': {
                        let q, tot; c = T === 1 ? ri(2, 4) : ri(2, 9); q = T === 1 ? ri(2, 4) : (T === 2 ? ri(2, 10) : ri(20, 100)); tot = c * q;
                        a = T === 3 ? ri(10, tot - 10) : ri(1, tot - 1); b = tot - a; break; }
                    case 'WP2_SUB_DIV': {
                        let q; c = T === 1 ? ri(2, 4) : ri(2, 9); q = T === 1 ? ri(2, 4) : (T === 2 ? ri(2, 9) : ri(10, 60)); const diff = c * q;
                        b = T === 1 ? ri(1, 20 - diff) : (T === 2 ? ri(1, Math.min(40, 100 - diff)) : ri(10, Math.min(400, 1000 - diff))); a = b + diff; break; }
                    case 'WP2_DIV_ADD': {
                        let q; b = T === 1 ? ri(2, 4) : ri(2, 9); q = T === 1 ? ri(2, 5) : (T === 2 ? ri(2, 9) : ri(10, 60)); a = b * q; c = T === 1 ? ri(1, 9) : (T === 2 ? ri(1, 30) : ri(10, 100)); break; }
                    case 'WP2_MUL_DIV': {
                        const lo = T === 3 ? 6 : 2, hi = T === 1 ? 6 : 9;
                        for (let k = 0; k < 80; k++) { a = ri(lo, hi); b = ri(lo, hi); c = ri(2, 9); if ((a * b) % c === 0 && c !== a && c !== b) break; } break; }
                }
                return { a: a, b: b, c: c };
            },
            tierFor: function (stage) { return Math.max(1, Math.min(3, (stage || 0) + 1)); },
            // 驗證器：重新獨立計算兩個步驟，檢查整除、非負、上限、文字數字一致、單位一致
            validate: function (q) {
                try {
                    const T = TWO_STEP_TEMPLATES[q.template_id]; if (!T || !q.isTwoStep || !q.steps || q.steps.length !== 2) return false;
                    const p = q.params; const nums = T.nums(p); const text = q.storyText; if (/[{}]/.test(text) || text.indexOf('undefined') >= 0 || text.indexOf('NaN') >= 0) return false;
                    if ((text.match(/？/g) || []).length !== 1) return false;
                    if (!nums.every(n => Number.isInteger(n) && n >= 1 && n <= 1000)) return false;
                    const r1 = T.r1(p), ans = T.ans(p); if (!Number.isInteger(r1) || !Number.isInteger(ans) || r1 < 0 || ans < 0 || r1 > 1000 || ans > 1000) return false;
                    if (q.template_id.endsWith('_DIV')) { const d = T.x2(p); if (d[0] % d[1] !== 0) return false; }
                    if (q.template_id === 'WP2_DIV_ADD' && p.a % p.b !== 0) return false;
                    if (q.steps[0].result !== r1 || q.steps[1].result !== ans || q.correctAnswer !== ans) return false;
                    if (q.steps[0].op !== T.ops[0] || q.steps[1].op !== T.ops[1]) return false;
                    // 依標準算式再算一次（獨立路徑）
                    const chk = ExprParser.parse(T.expr(p)); if (!chk.ok || chk.value !== ans) return false;
                    // 文字中的數字都要出現，且不能出現「故事裡沒有的」兩位數以上的雜訊數字
                    const inText = (text.match(/\d+/g) || []).map(Number); if (!nums.every(n => inText.indexOf(n) >= 0)) return false;
                    if (inText.some(n => nums.indexOf(n) < 0)) return false;
                    if (!q.params.keywords.every(k => text.indexOf(k) >= 0)) return false;
                    if (!q.unit || (q.steps[1].ask || '').indexOf('？') < 0) return false;
                    return true;
                } catch (e) { return false; }
            },
            generate: function (tier, templateId, avoid) {
                const id = templateId && TWO_STEP_TEMPLATES[templateId] ? templateId : this.pick(TWO_STEP_IDS); const T = TWO_STEP_TEMPLATES[id];
                for (let k = 0; k < 40; k++) {
                    const p = this.genNumbers(id, tier); if (![p.a, p.b, p.c].every(n => Number.isInteger(n))) continue;
                    const sIdx = this.ri(0, T.stories.length - 1); const st = T.stories[sIdx]; const it = this.pick(WP_ITEMS); const n = this.pick(WP_NAMES); let n2 = this.pick(WP_NAMES); while (n2 === n) n2 = this.pick(WP_NAMES);
                    const ctx = { n: n, n2: n2, i: st.plain ? '' : it.i, u: st.unit || it.u, a: p.a, b: p.b, c: p.c };
                    const text = fillTpl(st.t, ctx); const ask1 = fillTpl(st.ask1, ctx); const kws = st.k.map(x => fillTpl(x, ctx)); const unit = st.unit || it.u;
                    const x1 = T.x1(p), x2 = T.x2(p); const r1 = T.r1(p), ans = T.ans(p); const lastClause = text.split('，').pop();
                    const sym = o => OP_SYM[o];
                    const q = {
                        template_id: id, isWord: true, isTwoStep: true, stepCount: 2, expression: text, storyText: text, correctAnswer: ans, unit: unit,
                        params: { a: p.a, b: p.b, c: p.c, tpl: sIdx, item: it.i, keywords: kws, ops: T.ops.slice() }, misconceptions: {}, combined: T.merged(p),
                        steps: [{ op: T.ops[0], x: x1[0], y: x1[1], ask: ask1, result: r1, expr: `${x1[0]} ${sym(T.ops[0])} ${x1[1]}` },
                                { op: T.ops[1], x: x2[0], y: x2[1], ask: lastClause, result: ans, expr: `${x2[0]} ${sym(T.ops[1])} ${x2[1]}` }]
                    };
                    if (!this.validate(q)) continue;
                    q.island = '應用題島'; q.operation = 'wp2'; q.level = tier; q.fingerprint = `WP2|${id}|${p.a}|${p.b}|${p.c}|${sIdx}|${st.plain ? '' : it.i}`;
                    if (avoid && avoid.indexOf(q.fingerprint) >= 0 && k < 30) continue;
                    // 單位選項（含正確單位）
                    const opts = [unit]; UNIT_POOL.slice().sort(() => Math.random() - 0.5).forEach(u => { if (opts.length < 4 && opts.indexOf(u) < 0) opts.push(u); }); q.unitOptions = opts.sort(() => Math.random() - 0.5);
                    return q;
                }
                return null;
            },
            // phase：1 或 2（引導式）；merged 模式不看 phase
            // 回傳 { kind: 'phase1ok'|'solved'|'fail', code, studentExpression, studentAnswer }
            diagnose: function (q, sub, phase) {
                const s1 = q.steps[0], s2 = q.steps[1]; const symOf = o => OP_SYM[o] || '？';
                if (sub.mode === 'merged') {
                    const pr = ExprParser.parse(sub.expr); const val = parseFloat(sub.value);
                    const base = { studentExpression: String(sub.expr || ''), studentAnswer: String(sub.value) };
                    if (!pr.ok) return Object.assign(base, { kind: 'fail', code: 'ERR_WP_EXPR_FORMAT' });
                    const T = TWO_STEP_TEMPLATES[q.template_id]; const want = T.nums(q.params).slice().sort((x, y) => x - y); const have = pr.nums.slice().sort((x, y) => x - y);
                    const wantOps = T.ops.map(o => o).sort().join(''); const haveOps = pr.ops.slice().sort().join('');
                    const numsOK = want.length === have.length && want.every((v, i) => v === have[i]);
                    if (numsOK && wantOps === haveOps) {
                        if (Math.abs(pr.value - q.correctAnswer) > 1e-9) return Object.assign(base, { kind: 'fail', code: 'ERR_WP_COMBINE_ORDER' });
                        if (isNaN(val) || val !== q.correctAnswer) return Object.assign(base, { kind: 'fail', code: 'ERR_WP_STEP2_CALC' });
                        if (sub.unit !== q.unit) return Object.assign(base, { kind: 'fail', code: 'ERR_WP_UNIT' });
                        return Object.assign(base, { kind: 'solved', code: 'CORRECT' });
                    }
                    if (wantOps !== haveOps) { const has = pr.ops.indexOf(s1.op) >= 0; return Object.assign(base, { kind: 'fail', code: has ? 'ERR_WP_STEP2_OPERATION' : 'ERR_WP_STEP1_OPERATION' }); }
                    return Object.assign(base, { kind: 'fail', code: 'ERR_WP_STEP1_OPERATION' });
                }
                if (phase === 1) {
                    const v = parseFloat(sub.value); const base = { studentExpression: `${s1.x} ${symOf(sub.op)} ${s1.y} = ${sub.value}`, studentAnswer: String(sub.value) };
                    if (sub.op !== s1.op) return Object.assign(base, { kind: 'fail', code: 'ERR_WP_STEP1_OPERATION' });
                    if (isNaN(v) || v !== s1.result) return Object.assign(base, { kind: 'fail', code: 'ERR_WP_STEP1_CALC' });
                    return Object.assign(base, { kind: 'phase1ok', code: '' });
                }
                const v2 = parseFloat(sub.value); const base2 = { studentExpression: `${s2.x} ${symOf(sub.op)} ${s2.y} = ${sub.value}`, studentAnswer: String(sub.value) };
                if (sub.op !== s2.op) return Object.assign(base2, { kind: 'fail', code: 'ERR_WP_STEP2_OPERATION' });
                if (isNaN(v2) || v2 !== s2.result) return Object.assign(base2, { kind: 'fail', code: 'ERR_WP_STEP2_CALC' });
                if (sub.unit !== q.unit) return Object.assign(base2, { kind: 'fail', code: 'ERR_WP_UNIT' });
                return Object.assign(base2, { kind: 'solved', code: 'CORRECT' });
            }
        };

        // ==========================================================================
        //  晉階／降階策略（純函式，狀態放在 st，方便單元測試）
        // ==========================================================================
        const WP2Policy = {
            cfg: TWO_STEP_CONFIG,
            newState: function () { return { singles: [], twos: [], unlocked: false, stage: 0, okStreak: 0, consecutiveTwo: 0, remedial: null, retryTemplate: null, promoteNote: false, lastTemplates: [] }; },
            opUsable: function (st, op) { const rs = st.singles.slice(-this.cfg.opUsableWindow).filter(r => r.op === op); const good = rs.filter(r => r.firstTry).length; return good >= 1 && (rs.length - good) <= good; },
            shouldPromoteToTwoStep: function (st) {
                const c = this.cfg, s = st.singles; if (s.length < c.minSingleDone) return false;
                const w = s.slice(-Math.max(c.minSingleDone, Math.min(c.window, s.length))); const rate = w.filter(r => r.firstTry).length / w.length; if (rate < c.minFirstTryRate) return false;
                if (!s.slice(-c.lastNAllFirstTry).every(r => r.firstTry)) return false;
                const h = s.slice(-c.hintWindow); const avg = h.reduce((a, r) => a + r.hints, 0) / h.length; if (avg > c.maxAvgHints) return false;
                return true;
            },
            eligibleTemplates: function (st) { return TWO_STEP_IDS.filter(id => TWO_STEP_TEMPLATES[id].ops.every(op => this.opUsable(st, op))); },
            ratio: function (st) { return this.cfg.ratios[Math.max(0, Math.min(this.cfg.ratios.length - 1, st.stage))]; },
            mode: function (st) { const t = st.twos.slice(-this.cfg.mergedAfterOk); return t.length >= this.cfg.mergedAfterOk && t.every(r => r.firstTry) ? 'merged' : 'guided'; },
            // 決定下一題：{ kind:'one'|'two', op, template, reason }
            next: function (st, zone, enabled, rnd) {
                const c = this.cfg; rnd = rnd || Math.random;
                if (!enabled || c.zones.indexOf(zone) < 0) return { kind: 'one', reason: '' };
                if (st.remedial) return { kind: 'one', op: st.remedial.op, reason: st.remedial.reason, remedial: true };
                if (st.retryTemplate) { const t = st.retryTemplate; st.retryTemplate = null; return { kind: 'two', template: t, reason: 'RETRY_PARALLEL_TWO_STEP' }; }
                if (st.consecutiveTwo >= c.maxConsecutiveTwo) return { kind: 'one', reason: 'INTERLEAVE_SINGLE' };
                if (!st.unlocked) { if (this.shouldPromoteToTwoStep(st) && this.eligibleTemplates(st).length) { st.unlocked = true; st.stage = 0; st.promoteNote = true; } else return { kind: 'one', reason: '' }; }
                const el = this.eligibleTemplates(st); if (!el.length) return { kind: 'one', reason: '' };
                if (rnd() < this.ratio(st)) {
                    const fresh = el.filter(t => st.lastTemplates.indexOf(t) < 0); const pool = fresh.length ? fresh : el; const t = pool[Math.floor(rnd() * pool.length)];
                    const reason = st.promoteNote ? 'PROMOTE_TWO_STEP' : 'TWO_STEP_SCHEDULED'; st.promoteNote = false; return { kind: 'two', template: t, reason: reason };
                }
                return { kind: 'one', reason: '' };
            },
            recordSingle: function (st, r) {     // r: { op, firstTry, hints, remedial }
                st.singles.push({ op: r.op, firstTry: !!r.firstTry, hints: r.hints || 0 }); if (st.singles.length > 30) st.singles.shift(); st.consecutiveTwo = 0;
                if (st.remedial && r.remedial) { st.remedial.done++; if (st.remedial.done >= this.cfg.remedialSingles) { st.retryTemplate = st.remedial.template; st.remedial = null; } }
            },
            // r: { template, firstTry, hint3, failStep(1|2|0), onlyUnit }  → 回傳 { demoted, reason }
            recordTwo: function (st, r) {
                const c = this.cfg; st.twos.push({ template: r.template, firstTry: !!r.firstTry, hint3: !!r.hint3, failStep: r.failStep || 0 }); if (st.twos.length > 12) st.twos.shift();
                st.consecutiveTwo++; st.lastTemplates.push(r.template); if (st.lastTemplates.length > 2) st.lastTemplates.shift();
                if (r.firstTry) { st.okStreak++; if (st.okStreak >= c.advanceAfterOk) { st.stage = Math.min(c.ratios.length - 1, st.stage + 1); st.okStreak = 0; } } else st.okStreak = 0;
                const recent = st.twos.slice(-c.demoteWindow); const wrong = recent.filter(x => !x.firstTry && x.failStep > 0).length;
                const need = r.hint3 || wrong >= c.demoteWrong;
                if (need) {
                    const T = TWO_STEP_TEMPLATES[r.template]; const step = r.failStep === 2 ? 2 : 1; const reason = r.hint3 ? 'HINT_LEVEL_3' : (step === 1 ? 'REMEDIATE_STEP1' : 'REMEDIATE_STEP2');
                    st.remedial = { op: T.ops[step - 1], reason: reason, template: r.template, done: 0 }; st.stage = Math.max(0, st.stage - 1); st.okStreak = 0; st.consecutiveTwo = 0;
                    return { demoted: true, reason: reason };
                }
                return { demoted: false, reason: '' };
            }
        };
        const WP2 = { state: WP2Policy.newState(), reset: function () { this.state = WP2Policy.newState(); } };
        const REASON_LABEL = {
            PROMOTE_TWO_STEP: '達門檻，開始出兩步驟題', TWO_STEP_SCHEDULED: '穿插兩步驟題', INTERLEAVE_SINGLE: '避免連續兩步驟，穿插單步驟',
            REMEDIATE_STEP1: '降階：補救第一步', REMEDIATE_STEP2: '降階：補救第二步', HINT_LEVEL_3: '降階：用到第 3 級提示',
            RETRY_PARALLEL_TWO_STEP: '補救完成，回到平行兩步驟題', LEVEL_UP: '升級', LEVEL_DOWN: '降級補救'
        };

        // ==========================================================================
        //  兩步驟題介面：引導式（先第一步、再第二步、最後單位）→ 熟練後改合併列式
        // ==========================================================================
        const TwoStepUI = {
            q: null, mode: 'guided', phase: 1, ops: { 1: null, 2: null },
            focusId: function () { return this.mode === 'merged' ? 'tw-expr' : (this.phase === 1 ? 'tw-r1' : 'tw-r2'); },
            hide: function () {
                const t = document.getElementById('tw-panel'); if (t) t.style.display = 'none'; const sp = document.getElementById('wp-single-panel'); if (sp) sp.style.display = '';
                const tb = document.getElementById('tw-btn-submit'); if (tb) tb.style.display = 'none';
            },
            render: function (q) {
                this.q = q; this.mode = WP2Policy.mode(WP2.state); this.phase = 1; this.ops = { 1: null, 2: null };
                const sp = document.getElementById('wp-single-panel'); if (sp) sp.style.display = 'none'; const t = document.getElementById('tw-panel'); if (t) t.style.display = 'block';
                document.getElementById('wp-story-text').innerHTML = `<span class="word-problem-text" id="wp-content">${escapeHTML(q.expression)}</span>`;
                document.getElementById('tw-guided').style.display = this.mode === 'guided' ? 'block' : 'none'; document.getElementById('tw-merged').style.display = this.mode === 'merged' ? 'block' : 'none';
                document.getElementById('tw-s1-ask').innerText = '先求：' + q.steps[0].ask.replace(/^先求：/, ''); document.getElementById('tw-s2-ask').innerText = '再求：' + q.steps[1].ask;
                ['tw-r1', 'tw-r2', 'tw-r3', 'tw-expr'].forEach(id => { const el = document.getElementById(id); el.value = ''; el.disabled = false; el.classList.remove('apply-shake'); });
                document.getElementById('tw-r2').disabled = true; document.getElementById('tw-step2').classList.add('tw-locked'); document.getElementById('tw-step1').classList.remove('tw-done');
                const us = document.getElementById('tw-unit'); us.innerHTML = '<option value="">單位？</option>' + q.unitOptions.map(u => `<option value="${escapeHTML(u)}">${escapeHTML(u)}</option>`).join(''); us.value = ''; us.disabled = (this.mode === 'guided');
                document.getElementById('tw-mode-label').innerText = this.mode === 'guided' ? '引導式：一步一步來' : '合併列式：直接寫成一個算式';
                document.querySelectorAll('#tw-panel .btn-op').forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
                showWordProblemNextAction("RESET"); document.getElementById('tw-btn-submit').style.display = '';
                FB.set('wp-feedback', this.mode === 'guided' ? "這是兩步驟題！先完成第一步，再做第二步。" : "這是兩步驟題！請把算式合併寫出來，例如 (18+6)÷4，再填答案。", 'info');
                const f = document.getElementById(this.focusId()); if (f && f.focus) f.focus({ preventScroll: true });
            },
            selectOp: function (step, op) {
                if (this.mode !== 'guided' || step !== this.phase) return; this.ops[step] = op; QF.onEdit();
                document.querySelectorAll('#tw-ops' + step + ' .btn-op').forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
                const idMap = { "+": "add", "-": "sub", "*": "mul", "/": "div" }; const el = document.getElementById(`tw${step}-${idMap[op]}`); if (el) { el.classList.add('selected'); el.setAttribute('aria-pressed', 'true'); }
            },
            highlight: function () {
                const q = this.q; let content = escapeHTML(q.expression); q.params.keywords.forEach(kw => { const k = escapeHTML(kw); content = content.replace(k, `<span class="highlight-hint">${k}</span>`); });
                document.getElementById('wp-story-text').innerHTML = `<span class="word-problem-text">${content}</span>`;
            },
            readSubmission: function () {
                if (this.mode === 'merged') {
                    const expr = document.getElementById('tw-expr').value.trim(); const v = document.getElementById('tw-r3').value.trim(); const unit = document.getElementById('tw-unit').value;
                    if (!expr || v === '' || !unit) return null; return { mode: 'merged', expr: expr, value: v, unit: unit };
                }
                if (this.phase === 1) { const v = document.getElementById('tw-r1').value.trim(); if (!this.ops[1] || v === '') return null; return { mode: 'guided', phase: 1, op: this.ops[1], value: v }; }
                const v = document.getElementById('tw-r2').value.trim(); const unit = document.getElementById('tw-unit').value; if (!this.ops[2] || v === '' || !unit) return null;
                return { mode: 'guided', phase: 2, op: this.ops[2], value: v, unit: unit };
            },
            submit: async function () {
                if ((QF.state !== 'ANSWERING' && QF.state !== 'WRONG_FEEDBACK') || QF.busy) return;
                const sub = this.readSubmission();
                if (!sub) {
                    FB.set('wp-feedback', this.mode === 'merged' ? "⚠️ 請寫出算式、填答案並選擇單位喔！" : (this.phase === 1 ? "⚠️ 請先選擇第一步的方法，並輸入第一步的結果喔！" : "⚠️ 請選擇第二步的方法、輸入答案並選擇單位喔！"), 'error');
                    return;
                }
                QF.busy = true; QF.state = 'SUBMITTING';
                try {
                    const q = this.q; const res = GameFlowController.submitTwoStep(sub);
                    FB.set('wp-feedback', res.msg, res.isCorrect || res.phaseDone ? "success" : "error", { hint: (res.isCorrect || res.phaseDone) ? 0 : res.hintLvl });
                    let sent = null; if (currentUser && !res.phaseDone) { try { sent = sendAnswer(buildAnswerPayload(res, res.studentAnswer, { expr: res.studentExpression })); } catch (e) { console.error(e); } }
                    if (res.phaseDone) {          // 第一步正確：保留成果，鎖住第一步，進入第二步
                        this.phase = 2; document.getElementById('tw-r1').disabled = true; document.getElementById('tw-step1').classList.add('tw-done'); document.getElementById('tw-step2').classList.remove('tw-locked');
                        document.getElementById('tw-r2').disabled = false; document.getElementById('tw-unit').disabled = false; QF.state = 'ANSWERING';
                        const f = document.getElementById('tw-r2'); if (f && f.focus) f.focus({ preventScroll: true });
                    } else if (!res.isCorrect) {
                        EffectEngine.shakeElement(this.focusId()); if (res.highlight) this.highlight(); QF.state = 'WRONG_FEEDBACK';
                        const f = document.getElementById(this.focusId()); if (f && f.focus) f.focus({ preventScroll: true });
                    } else {
                        ['tw-r1', 'tw-r2', 'tw-expr', 'tw-r3', 'tw-unit'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
                        showWordProblemNextAction(res.nextAct); document.getElementById('tw-btn-submit').style.display = 'none'; QF.state = 'CORRECT_FEEDBACK';
                        if (res.earnedStars > 0) { await EffectEngine.flyStar(); }
                        QF.state = res.nextAct === "FINISH" ? 'FINISHED' : 'NEXT_READY';
                        if (res.nextAct === "FINISH") { IslandUI.showResult(); if (sent && typeof TaskRun !== 'undefined') TaskRun.afterFinish(sent); }
                    }
                } catch (e) { console.error(e); if (QF.state === 'SUBMITTING') QF.state = 'ANSWERING'; }
                finally { QF.busy = false; }
            }
        };
