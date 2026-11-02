/* 字典、提示、情境庫、題庫、自適應引擎、遊戲流程 */
        // ==========================================================================
        //  共用字典：運算名稱、錯誤診斷字典（學生提示與教師端共用）
        // ==========================================================================
        const OP_ZH = { "+": "加法", "-": "減法", "*": "乘法", "/": "除法" };
        const OP_SYM = { "+": "＋", "-": "－", "*": "×", "/": "÷" };
        const OP_KEY = { "+": "add", "-": "sub", "*": "mul", "/": "div" };
        const CONCEPT_KEY = { "加法島": "add", "減法島": "sub", "乘法島": "mul", "除法島": "div", "四則運算島": "order" };
        const ERROR_CAT = { concept: "概念錯誤", situation: "情境判斷錯誤", order: "運算順序錯誤", calc: "計算錯誤", other: "其他／無法判定" };
        // 舊版資料用過的錯誤代碼，統一對應到新代碼（教師端分析用）
        const ERROR_ALIASES = { ERR_WRONG_OP: "ERR_OPERATION_MISMATCH", ERR_LEFT_TO_RIGHT_AS: "ERR_ORDER_LEFT_TO_RIGHT", ERR_LEFT_TO_RIGHT_MD: "ERR_ORDER_LEFT_TO_RIGHT" };
        function normCode(c) { c = String(c || ""); return ERROR_ALIASES[c] || c; }

        const ISLAND_TIP2 = {
            "加法島": "把原本的一群和新來的一群放在一起，看看一共有多少。",
            "減法島": "從原本的數量拿掉被拿走的，看看還剩下多少。",
            "乘法島": "每一組的數量要相同，先確認有幾組、每組幾個。",
            "除法島": "想想平均分：每一份都一樣多，用乘法表反過來找。",
            "應用題島": "標出題目在問什麼，判斷數量是變多、變少、一組一組，還是平分。",
            "四則運算島": "先找括號，再找乘除，最後才算加減；同一級由左往右。"
        };
        const WP_RELATION = { "+": "兩個數量「合起來」，結果會變多", "-": "從原來的數量「拿走」一部分，或比較差多少，結果會變少", "*": "每一組一樣多，有很多組，要算全部有多少", "/": "把全部「平均分」，每一份都一樣多" };
        const WP_OP_TIP = {
            "+": "題目說「又拿了、合起來、一共」，東西會變多喔！",
            "-": "題目說「拿走、送給、用掉、剩下」或問「差多少」，數量會變少或要比較差距。",
            "*": "題目說「每一組都一樣多」，要算「全部共有幾個」。",
            "/": "題目說「平分、每人分到、每幾個裝一袋」，要公平分配，想想用什麼方法？"
        };

        const ERROR_DICT = {
            ERR_ADD_CARRY_FORGOTTEN: { label: "加法忘記進位", cat: "calc", t1: "👀 看看個位數加起來，有沒有滿 10？", t2: "滿 10 要向前一位進 1，再重算一次。" },
            ERR_SUB_REVERSE_DIGIT: { label: "減法不夠減時用大減小", cat: "calc", t1: "👀 個位數不夠減的時候，不能用下面的數減上面的數。", t2: "不夠減要向前一位「借 1」變成 10，再來減。" },
            ERR_ADD_SUB_CONFUSED: { label: "加法題誤用減法", cat: "concept", t1: "👀 這題是要「合起來」還是「拿走」？", t2: "加法是把兩個數量合在一起，結果會比原來的數更大。" },
            ERR_SUB_ADD_CONFUSED: { label: "減法題誤用加法", cat: "concept", t1: "👀 這題是「拿走」，數量會變多還是變少？", t2: "減法是從原來的數量拿走一部分，結果會比原來的數小。" },
            ERR_MUL_ADD_CONFUSED: { label: "乘法題誤用加法", cat: "concept", t1: "👀 乘法是「幾組、每組幾個」，不是把兩個數字直接加起來。", t2: "例如 3 × 4 是 3 組，每組 4 個：4＋4＋4。" },
            ERR_DIV_MUL_CONFUSED: { label: "除法題誤用乘法", cat: "concept", t1: "👀 除法是「平分」，會越分越少，答案會比原來的數小。", t2: "想想：什麼數字乘以除數，會等於被除數？" },
            ERR_ORDER_ADD_FIRST: { label: "沒有先乘除就先加減", cat: "order", t1: "👀 找找看，算式裡有沒有乘號或除號？", t2: "沒有括號時，要先算乘、除，再算加、減。" },
            ERR_ORDER_PAREN_IGNORED: { label: "沒有先算括號", cat: "order", t1: "👀 算式裡有括號喔！", t2: "括號裡面的要最先算。" },
            ERR_ORDER_LEFT_TO_RIGHT: { label: "同級運算沒有由左到右", cat: "order", t1: "👀 看看同一級的運算，有沒有照順序算？", t2: "只有加減、或只有乘除的時候，要由左邊往右邊一個一個算。" },
            ERR_CONCEPT_COMBINE: { label: "應該合併卻用了拿走（應用題）", cat: "situation", t1: "👀 想一想：題目是在把兩個數量「合起來」嗎？", t2: WP_OP_TIP["+"] },
            ERR_CONCEPT_TAKEAWAY: { label: "應該拿走卻用了合併（應用題）", cat: "situation", t1: "👀 想一想：題目是在「拿走」或「比較差多少」嗎？", t2: WP_OP_TIP["-"] },
            ERR_OPERATION_MISMATCH: { label: "應用題選錯運算", cat: "situation", t1: "👀 先找出題目在問什麼：是變多、變少、一組一組，還是平分？", t2: function (q) { return WP_OP_TIP[q.params.op]; } },
            ERR_CALCULATION: { label: "計算小失誤", cat: "calc", t1: "👍 方向應該是對的，可能是計算有點小失誤，再算一次！", t2: "一步一步慢慢算，檢查進位、退位或乘法表。" },
            ERR_WP_STEP1_OPERATION: { label: "兩步驟題：第一步選錯方法", cat: "situation", t1: "👀 先看第一個問題：題目要先求什麼？是變多、變少、一組一組，還是平分？", t2: function (q) { return WP_OP_TIP[q.steps[0].op]; } },
            ERR_WP_STEP1_CALC: { label: "兩步驟題：第一步計算錯誤", cat: "calc", t1: "👍 第一步的方法對了，可能是計算有小失誤，再算一次！", t2: "一步一步慢慢算，檢查進位、退位或乘法表。" },
            ERR_WP_STEP2_OPERATION: { label: "兩步驟題：第二步選錯方法", cat: "situation", t1: "👀 第一步做完了！接下來題目還要你做什麼？", t2: function (q) { return WP_OP_TIP[q.steps[1].op]; } },
            ERR_WP_STEP2_CALC: { label: "兩步驟題：第二步計算錯誤", cat: "calc", t1: "👍 第二步的方法對了，可能是計算有小失誤，再算一次！", t2: "用第一步的結果來算，一步一步慢慢算。" },
            ERR_WP_UNIT: { label: "兩步驟題：單位選錯", cat: "calc", t1: "👀 算對了！再看看問題最後問的是「幾什麼」？", t2: "單位要和問題句最後問的東西一樣。" },
            ERR_WP_EXPR_FORMAT: { label: "兩步驟題：算式格式不正確", cat: "other", t1: "⚠️ 算式看不懂喔！只能用數字、＋ － × ÷ 和圓括號 ( )。", t2: "例如：(18＋6)÷4　或　3×5＋2" },
            ERR_WP_COMBINE_ORDER: { label: "兩步驟題：合併列式順序錯誤", cat: "order", t1: "👀 你的數字和方法都對，但順序不對。想想哪一步要先算？", t2: "先做的那一步要用括號包起來，括號裡面最先算。" },
            ERR_INPUT_EMPTY: { label: "未輸入答案", cat: "other", t1: "⚠️ 請先輸入答案喔！", t2: "" },
            ERR_UNKNOWN: { label: "其他／無法判定", cat: "other", t1: "🤔 這個答案不太對喔，再檢查一次！", t2: function (q) { return ISLAND_TIP2[q.island] || ""; } }
        };

        const Scaffold = {
            build: function (q, code) {
                const p = q.params || {}; const a = p.a, b = p.b, c = p.c, d = p.d;
                if (q.isTwoStep) {
                    const s1 = q.steps[0], s2 = q.steps[1];
                    if (code === "ERR_WP_STEP1_OPERATION" || code === "ERR_WP_STEP1_CALC") return `① 第一個問題：${s1.ask}\n② 要用【${OP_ZH[s1.op]}】：${s1.x} ${OP_SYM[s1.op]} ${s1.y}\n③ 慢慢算出結果，再輸入`;
                    if (code === "ERR_WP_STEP2_OPERATION" || code === "ERR_WP_STEP2_CALC") return `① 第一步的結果是 ${s1.result}\n② 接著用【${OP_ZH[s2.op]}】：${s2.x} ${OP_SYM[s2.op]} ${s2.y}\n③ 算出答案，再輸入`;
                    if (code === "ERR_WP_UNIT") return `答案數字已經對了！\n請看問題最後一句：「${q.expression.split("，").pop()}」\n它問的是「幾什麼」，選出對應的單位`;
                    if (code === "ERR_WP_COMBINE_ORDER" || code === "ERR_WP_EXPR_FORMAT") return `① 先做：${s1.x} ${OP_SYM[s1.op]} ${s1.y}\n② 再做：（第一步的結果）${OP_SYM[s2.op]} ${s2.y}\n③ 把先做的那一步用括號包起來，再寫成一個算式`;
                    return `① 先算：${s1.x} ${OP_SYM[s1.op]} ${s1.y}\n② 再算：${s2.x} ${OP_SYM[s2.op]} ${s2.y}，輸入答案`;
                }
                if (q.isWord) {
                    const sym = OP_SYM[p.op];
                    if (code === "ERR_CALCULATION") return `你選的方法是對的！\n算式是：${a} ${sym} ${b}\n一步一步算算看，再輸入答案`;
                    const opHint = (code === "ERR_CONCEPT_COMBINE" || code === "ERR_CONCEPT_TAKEAWAY" || code === "ERR_OPERATION_MISMATCH") ? `\n③ 看過線索，這題要用【${OP_ZH[p.op]}】，請重新選方法再算` : `\n③ 選好方法，把 ${a} 和 ${b} 放進算式算算看，再輸入答案`;
                    return `① 找已知量：${a}、${b}\n② 想關係：${WP_RELATION[p.op]}${opHint}`;
                }
                switch (q.template_id) {
                    case "ADD_BASIC": {
                        if (q.level <= 1) return `把 ${a} 和 ${b} 放在一起：從 ${a} 開始，再往後數 ${b} 個，數到哪裡就是答案。`;
                        if (q.level >= 4) return `① 從個位開始，一位一位加\n② 滿 10 就向前一位進 1\n③ 把每一位的結果合起來，輸入答案`;
                        const u = (a % 10) + (b % 10);
                        return `① 先算個位：${a % 10} ＋ ${b % 10} ＝ ${u}${u >= 10 ? "（滿 10，寫 " + (u - 10) + "、向十位進 1）" : ""}\n② 再把十位（加上進位）加起來\n③ 把十位和個位合起來，輸入答案`;
                    }
                    case "SUB_BASIC": {
                        if (q.level <= 1) return `從 ${a} 個裡面拿走 ${b} 個，數一數剩下幾個。`;
                        if (q.level >= 4) return `① 從個位開始，一位一位減\n② 不夠減就向前一位借 1（變成 10）\n③ 把每一位的結果合起來，輸入答案`;
                        const ua = a % 10, ub = b % 10;
                        return ua >= ub ? `① 先算個位：${ua} － ${ub} ＝ ${ua - ub}\n② 再算十位\n③ 合起來，輸入答案` : `① 個位 ${ua} 不夠減 ${ub}，向十位借 1：${ua + 10} － ${ub} ＝ ${ua + 10 - ub}\n② 十位被借走 1，再算十位\n③ 合起來，輸入答案`;
                    }
                    case "MUL_BASIC": return `${a} × ${b} 就是 ${a} 組、每組 ${b} 個：\n${Array(a).fill(b).join(" ＋ ")}\n一組一組加起來，輸入答案`;
                    case "DIV_BASIC": return `${a} ÷ ${b}：想一想「${b} × ？ ＝ ${a}」\n用 ${b} 的乘法表找找看，輸入答案`;
                    case "LR_AS": return `① 由左往右，先算：${a} － ${b} ＝ ${a - b}\n② 再算：${a - b} ＋ ${c}，輸入答案`;
                    case "LR_MD": return `① 由左往右，先算：${a} ÷ ${b} ＝ ${a / b}\n② 再算：${a / b} × ${c}，輸入答案`;
                    case "MD_FIRST": return `① 先算乘法：${b} × ${c} ＝ ${b * c}\n② 算式變成：${a} ＋ ${b * c} － ${d}，再由左往右算，輸入答案`;
                    case "PAREN_AS_SUB": return `① 先算括號：${a} － ${b} ＝ ${a - b}\n② 再算：${a - b} × ${c}，輸入答案`;
                    case "PAREN_DIV_MUL": return `① 先算括號：${a} － ${b} ＝ ${a - b}\n② 再由左往右：${a - b} ÷ ${c} ＝ ${(a - b) / c}\n③ 最後算：${(a - b) / c} × ${d}，輸入答案`;
                    default: return "把題目拆成小步驟，一步一步慢慢算。";
                }
            }
        };

        // 三級提示：第1級聚焦（不說答案）→ 第2級概念（並標示位置）→ 第3級分步鷹架（最後一步仍由學生輸入）
        const HintEngine = {
            build: function (q, code, lvl, zone) {
                const d = ERROR_DICT[code] || ERROR_DICT.ERR_UNKNOWN;
                const call = x => (typeof x === "function" ? x(q) : x);
                let msg = call(d.t1);
                if (lvl >= 2 && zone !== "MASTERY") { const t2 = call(d.t2); if (t2) msg += "\n💡 " + t2; }
                if (lvl >= 3) msg += "\n🪜 " + Scaffold.build(q, code);
                return msg;
            }
        };

        // ==========================================================================
        //  應用題情境庫（人名、物品、句型、關鍵字都會隨機抽換）
        // ==========================================================================
        const WP_NAMES = ["小明", "小華", "小美", "阿傑", "小安", "小如", "大雄", "小芸", "阿宏", "小語"];
        const WP_ITEMS = [
            { i: "糖果", u: "顆" }, { i: "貼紙", u: "張" }, { i: "鉛筆", u: "枝" }, { i: "蘋果", u: "顆" }, { i: "彈珠", u: "顆" }, { i: "故事書", u: "本" },
            { i: "氣球", u: "個" }, { i: "餅乾", u: "塊" }, { i: "卡片", u: "張" }, { i: "積木", u: "塊" }, { i: "橡皮擦", u: "個" }, { i: "貝殼", u: "個" }
        ];
        const WP_TEMPLATES = {
            "+": [
                { t: "{n}有 {a} {u}{i}，又拿了 {b} {u}，一共有幾{u}{i}？", k: ["又拿了", "一共"] },
                { t: "{n}原本有 {a} {u}{i}，媽媽又買了 {b} {u}，現在共有幾{u}{i}？", k: ["又買了", "共有"] },
                { t: "籃子裡有 {a} {u}{i}，再放進 {b} {u}，合起來有幾{u}{i}？", k: ["再放進", "合起來"] },
                { t: "{n}有 {a} {u}{i}，{n2}有 {b} {u}{i}，兩人合起來有幾{u}{i}？", k: ["合起來"] },
                { t: "盒子裡本來有 {a} {u}{i}，又放進去 {b} {u}，總共有幾{u}{i}？", k: ["又放進去", "總共"] }
            ],
            "-": [
                { t: "桌上有 {a} {u}{i}，被拿走 {b} {u}，還剩下幾{u}{i}？", k: ["拿走", "剩下"] },
                { t: "{n}有 {a} {u}{i}，送給朋友 {b} {u}，還剩下幾{u}{i}？", k: ["送給", "剩下"] },
                { t: "盒子裡有 {a} {u}{i}，用掉了 {b} {u}，還剩幾{u}{i}？", k: ["用掉", "還剩"] },
                { t: "{n}有 {a} {u}{i}，{n2}有 {b} {u}{i}，{n}比{n2}多幾{u}{i}？", k: ["比{n2}多"] },
                { t: "店裡有 {a} {u}{i}，賣出 {b} {u}，現在還有幾{u}{i}？", k: ["賣出", "還有"] }
            ],
            "*": [
                { t: "一盒{i}有 {a} {u}，買了 {b} 盒，共有幾{u}{i}？", k: ["一盒", "共有"] },
                { t: "每個盤子放 {a} {u}{i}，有 {b} 個盤子，一共有幾{u}{i}？", k: ["每個盤子", "一共"] },
                { t: "{n}每天吃 {a} {u}{i}，{b} 天一共吃幾{u}{i}？", k: ["每天", "一共"] },
                { t: "每排有 {a} 個座位，有 {b} 排，一共有幾個座位？", k: ["每排", "一共"], unit: "個" },
                { t: "每個袋子裝 {a} {u}{i}，{n}準備了 {b} 個袋子，總共裝了幾{u}{i}？", k: ["每個袋子", "總共"] }
            ],
            "/": [
                { t: "老師有 {a} {u}{i}，平分給 {b} 個人，每人分到幾{u}{i}？", k: ["平分給", "每人分到"] },
                { t: "一共有 {a} {u}{i}，每 {b} {u}裝成一袋，可以裝成幾袋？", k: ["每 {b} {u}", "幾袋"], unit: "袋" },
                { t: "{n}把 {a} {u}{i}平均放進 {b} 個盒子，每個盒子放幾{u}{i}？", k: ["平均放進", "每個盒子"] },
                { t: "{a} 個人坐車，每輛車坐 {b} 人，需要幾輛車？", k: ["每輛車坐", "需要幾輛"], unit: "輛" },
                { t: "{n}有 {a} {u}{i}，每個人分 {b} {u}，可以分給幾個人？", k: ["每個人分", "分給幾個人"], unit: "人" }
            ]
        };
        function fillTpl(t, ctx) { return t.replace(/\{(\w+)\}/g, function (m, k) { return ctx[k] !== undefined ? ctx[k] : m; }); }

        // ==========================================================================
        //  題庫引擎（每島 4 個難度；所有答案由同一份參數計算，並先驗證才出題）
        // ==========================================================================
        const MathEngineV2 = {
            ri: function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
            pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
            shuffle: function (arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
            maxLv: { "加法島": 4, "減法島": 4, "乘法島": 3, "除法島": 3, "四則運算島": 4, "應用題島": 3 },
            addNoCarry: function (a, b) { let r = 0, m = 1; while (a > 0 || b > 0) { r += (((a % 10) + (b % 10)) % 10) * m; a = Math.floor(a / 10); b = Math.floor(b / 10); m *= 10; } return r; },
            subNoBorrow: function (a, b) { let r = 0, m = 1; while (a > 0 || b > 0) { r += Math.abs((a % 10) - (b % 10)) * m; a = Math.floor(a / 10); b = Math.floor(b / 10); m *= 10; } return r; },

            generateQuestion: function (islandCode, level, wpOp) {
                const island = ISLAND_ALIASES[islandCode] || islandCode;
                const lv = Math.max(1, Math.min(level || 1, this.maxLv[island] || 3));
                for (let attempts = 0; attempts < 30; attempts++) {
                    let q = null;
                    try { q = this.build(island, lv, wpOp); } catch (e) { console.error(e); }
                    if (q && this.validate(q, island)) return this.finish(q, island, lv);
                }
                return this.finish(this.fallback(island, wpOp), island, 1);
            },
            validate: function (q, island) {
                if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0) return false;
                if (island === "加法島" && q.correctAnswer > 99) return false;
                if (island === "減法島" && q.params.a < q.params.b) return false;
                if (island === "除法島" && q.params.a % q.params.b !== 0) return false;
                return true;
            },
            finish: function (q, island, lv) {
                q.island = island; q.level = lv; q.isWord = !!q.isWord;
                q.operation = q.isWord ? "wp_" + OP_KEY[q.params.op] : (CONCEPT_KEY[island] || "other");
                Object.keys(q.misconceptions || {}).forEach(function (k) { if (q.misconceptions[k] === q.correctAnswer) delete q.misconceptions[k]; });
                q.fingerprint = `${q.template_id}_${Object.values(q.params).filter(v => typeof v !== "object").join("_")}`;
                return q;
            },
            fallback: function (island, wpOp) {
                const mk = (id, expr, ans, params, mis) => ({ template_id: id, expression: expr, correctAnswer: ans, params: params, misconceptions: mis || {} });
                if (island === "應用題島") return this.buildWordFixed(wpOp || "+");
                if (island === "減法島") return mk("SUB_BASIC", "9 - 4", 5, { a: 9, b: 4 });
                if (island === "乘法島") return mk("MUL_BASIC", "3 × 4", 12, { a: 3, b: 4 });
                if (island === "除法島") return mk("DIV_BASIC", "12 ÷ 3", 4, { a: 12, b: 3 });
                if (island === "四則運算島") return mk("LR_AS", "20 - 5 + 3", 18, { a: 20, b: 5, c: 3 });
                return mk("ADD_BASIC", "3 + 4", 7, { a: 3, b: 4 });
            },
            buildWordFixed: function (op) {
                const a = op === "/" ? 12 : 6, b = op === "/" ? 3 : 2;
                const ans = { "+": a + b, "-": a - b, "*": a * b, "/": a / b }[op];
                const text = { "+": `小明有 ${a} 顆糖果，又拿了 ${b} 顆，一共有幾顆糖果？`, "-": `桌上有 ${a} 顆糖果，被拿走 ${b} 顆，還剩下幾顆糖果？`, "*": `一盒糖果有 ${a} 顆，買了 ${b} 盒，共有幾顆糖果？`, "/": `老師有 ${a} 顆糖果，平分給 ${b} 個人，每人分到幾顆糖果？` }[op];
                const k = { "+": ["又拿了", "一共"], "-": ["拿走", "剩下"], "*": ["一盒", "共有"], "/": ["平分給", "每人分到"] }[op];
                return { template_id: "WP_" + OP_KEY[op].toUpperCase(), isWord: true, expression: text, storyText: text, correctAnswer: ans, unit: "顆", params: { a: a, b: b, op: op, keywords: k, tpl: -1 }, misconceptions: {} };
            },

            build: function (island, lv, wpOp) {
                const ri = this.ri.bind(this);
                let a, b, q = { misconceptions: {} };
                if (island === "應用題島") return this.buildWord(wpOp || this.pick(["+", "-", "*", "/"]), lv);

                if (island === "加法島") {
                    if (lv === 1) { a = ri(1, 8); b = ri(1, 10 - a); }
                    else if (lv === 2) { a = ri(1, 4) * 10 + ri(1, 4); b = ri(1, 4) * 10 + ri(1, 4); }
                    else if (lv === 3) { const ua = ri(2, 9), ub = ri(10 - ua, 9), ta = ri(1, 7), tb = ri(1, 8 - ta); a = ta * 10 + ua; b = tb * 10 + ub; }
                    else { const ua = ri(2, 9), ub = ri(10 - ua, 9), ta = ri(4, 6), tb = ri(2, 8 - ta); a = ta * 10 + ua; b = tb * 10 + ub; }
                    q.template_id = "ADD_BASIC"; q.params = { a: a, b: b }; q.expression = `${a} + ${b}`; q.correctAnswer = a + b;
                    q.misconceptions["ERR_ADD_CARRY_FORGOTTEN"] = this.addNoCarry(a, b); q.misconceptions["ERR_ADD_SUB_CONFUSED"] = Math.abs(a - b);
                } else if (island === "減法島") {
                    if (lv === 1) { a = ri(2, 10); b = ri(1, a - 1); }
                    else if (lv === 2) { const ta = ri(2, 5), ua = ri(5, 9); a = ta * 10 + ua; b = ri(1, Math.min(2, ta - 1)) * 10 + ri(1, ua - 1); }
                    else if (lv === 3) { const ua = ri(0, 8), ub = ri(ua + 1, 9), ta = ri(3, 9), tb = ri(1, ta - 2); a = ta * 10 + ua; b = tb * 10 + ub; }
                    else { const ua = ri(0, 7), ub = ri(ua + 1, 9), ta = ri(6, 9), tb = ri(2, ta - 2); a = ta * 10 + ua; b = tb * 10 + ub; }
                    q.template_id = "SUB_BASIC"; q.params = { a: a, b: b }; q.expression = `${a} - ${b}`; q.correctAnswer = a - b;
                    q.misconceptions["ERR_SUB_REVERSE_DIGIT"] = this.subNoBorrow(a, b); q.misconceptions["ERR_SUB_ADD_CONFUSED"] = a + b;
                } else if (island === "乘法島") {
                    if (lv === 1) { a = ri(2, 4); b = ri(2, 4); } else if (lv === 2) { a = ri(3, 6); b = ri(3, 6); } else { a = ri(6, 9); b = ri(6, 9); }
                    q.template_id = "MUL_BASIC"; q.params = { a: a, b: b }; q.expression = `${a} × ${b}`; q.correctAnswer = a * b;
                    q.misconceptions["ERR_MUL_ADD_CONFUSED"] = a + b;
                } else if (island === "除法島") {
                    let dv, ans;
                    if (lv === 1) { dv = ri(2, 4); ans = ri(2, 4); } else if (lv === 2) { dv = ri(3, 6); ans = ri(3, 7); } else { dv = ri(6, 9); ans = ri(5, 9); }
                    a = dv * ans; b = dv;
                    q.template_id = "DIV_BASIC"; q.params = { a: a, b: b }; q.expression = `${a} ÷ ${b}`; q.correctAnswer = ans;
                    q.misconceptions["ERR_DIV_MUL_CONFUSED"] = a * b;
                } else {
                    const pool = { 1: ["LR_AS", "LR_AS", "LR_MD"], 2: ["MD_FIRST"], 3: ["PAREN_AS_SUB", "MD_FIRST"], 4: ["PAREN_DIV_MUL", "PAREN_AS_SUB", "MD_FIRST"] }[lv];
                    const t = this.pick(pool); q.template_id = t;
                    if (t === "LR_AS") { a = ri(10, 30); b = ri(1, a); const c = ri(1, 20); q.params = { a: a, b: b, c: c }; q.expression = `${a} - ${b} + ${c}`; q.correctAnswer = a - b + c; q.misconceptions["ERR_ORDER_LEFT_TO_RIGHT"] = a - (b + c); }
                    else if (t === "LR_MD") { const b2 = ri(2, 9), c2 = ri(2, 9), a2 = ri(2, 12) * b2; q.params = { a: a2, b: b2, c: c2 }; q.expression = `${a2} ÷ ${b2} × ${c2}`; q.correctAnswer = (a2 / b2) * c2; q.misconceptions["ERR_ORDER_LEFT_TO_RIGHT"] = a2 / (b2 * c2); }
                    else if (t === "MD_FIRST") { const b3 = ri(2, 9), c3 = ri(2, 9), a3 = ri(10, 50); let d3 = ri(1, a3 + b3 * c3); if (d3 === a3) d3 = d3 + 1; q.params = { a: a3, b: b3, c: c3, d: d3 }; q.expression = `${a3} + ${b3} × ${c3} - ${d3}`; q.correctAnswer = a3 + b3 * c3 - d3; q.misconceptions["ERR_ORDER_ADD_FIRST"] = (a3 + b3) * c3 - d3; }
                    else if (t === "PAREN_AS_SUB") { const c4 = ri(2, 9), b4 = ri(10, 50), a4 = b4 + ri(2, 12); q.params = { a: a4, b: b4, c: c4 }; q.expression = `( ${a4} - ${b4} ) × ${c4}`; q.correctAnswer = (a4 - b4) * c4; q.misconceptions["ERR_ORDER_PAREN_IGNORED"] = a4 - b4 * c4; }
                    else { const c5 = ri(2, 9), q5 = ri(2, 9), b5 = ri(5, 40); let d5 = ri(2, 9); while (d5 === c5) d5 = ri(2, 9); const a5 = b5 + c5 * q5; q.params = { a: a5, b: b5, c: c5, d: d5 }; q.expression = `( ${a5} - ${b5} ) ÷ ${c5} × ${d5}`; q.correctAnswer = q5 * d5; q.misconceptions["ERR_ORDER_PAREN_IGNORED"] = a5 - (b5 / c5) * d5; q.misconceptions["ERR_ORDER_LEFT_TO_RIGHT"] = (a5 - b5) / (c5 * d5); }
                }
                return q;
            },

            buildWord: function (op, lv) {
                const ri = this.ri.bind(this); let a, b, ans;
                if (op === "+") { if (lv === 1) { a = ri(2, 12); b = ri(2, 20 - a); } else if (lv === 2) { a = ri(10, 35); b = ri(5, 50 - a); } else { a = ri(25, 70); b = ri(10, 99 - a); } ans = a + b; }
                else if (op === "-") { if (lv === 1) { a = ri(6, 20); b = ri(1, a - 1); } else if (lv === 2) { a = ri(20, 50); b = ri(5, a - 5); } else { a = ri(40, 99); b = ri(11, a - 10); } ans = a - b; }
                else if (op === "*") { if (lv === 1) { a = ri(2, 5); b = ri(2, 5); } else if (lv === 2) { a = ri(2, 9); b = ri(2, 9); } else { a = ri(6, 9); b = ri(6, 9); } ans = a * b; }
                else { let dv, qt; if (lv === 1) { dv = ri(2, 5); qt = ri(2, 5); } else if (lv === 2) { dv = ri(2, 9); qt = ri(2, 9); } else { dv = ri(6, 9); qt = ri(6, 9); } a = dv * qt; b = dv; ans = qt; }
                const tpls = WP_TEMPLATES[op]; const idx = ri(0, tpls.length - 1); const tpl = tpls[idx];
                const it = this.pick(WP_ITEMS); const n = this.pick(WP_NAMES); let n2 = this.pick(WP_NAMES); while (n2 === n) n2 = this.pick(WP_NAMES);
                const ctx = { n: n, n2: n2, i: it.i, u: it.u, a: a, b: b };
                const text = fillTpl(tpl.t, ctx); const kws = tpl.k.map(function (k) { return fillTpl(k, ctx); });
                return { template_id: "WP_" + OP_KEY[op].toUpperCase(), isWord: true, expression: text, storyText: text, correctAnswer: ans, unit: tpl.unit || it.u, params: { a: a, b: b, op: op, keywords: kws, tpl: idx }, misconceptions: {} };
            },

            diagnoseError: function (q, op, ansStr) {
                const ans = parseFloat(ansStr);
                if (q.isWord) {
                    if (!op || isNaN(ans)) return { isCorrect: false, errorCode: "ERR_INPUT_EMPTY", message: "請先選擇方法並輸入答案喔！" };
                    if (op === q.params.op && ans === q.correctAnswer) return { isCorrect: true, errorCode: "CORRECT", message: "🎉 太棒了！方法和答案都正確！" };
                    if (op !== q.params.op) {
                        const code = q.params.op === "+" ? "ERR_CONCEPT_COMBINE" : (q.params.op === "-" ? "ERR_CONCEPT_TAKEAWAY" : "ERR_OPERATION_MISMATCH");
                        return { isCorrect: false, errorCode: code };
                    }
                    return { isCorrect: false, errorCode: "ERR_CALCULATION" };
                }
                if (isNaN(ans)) return { isCorrect: false, errorCode: "ERR_INPUT_EMPTY", message: "請輸入答案喔！" };
                if (ans === q.correctAnswer) return { isCorrect: true, errorCode: "CORRECT", message: "🎉 太棒了！計算完全正確！" };
                for (const [code, val] of Object.entries(q.misconceptions)) { if (ans === val) return { isCorrect: false, errorCode: code }; }
                const diff = Math.abs(ans - q.correctAnswer);
                if (diff <= 2 || diff === 10 || diff === 100) return { isCorrect: false, errorCode: "ERR_CALCULATION" };
                return { isCorrect: false, errorCode: "ERR_UNKNOWN" };
            }
        };

        // ==========================================================================
        //  自適應引擎：前面答對（首次就對）才升級；一直答錯就停在相近難度反覆練習
        //  每個「概念」各自記錄難度；每次進入新的區域都從最簡單開始
        // ==========================================================================
        const AdaptiveEngine = {
            zoneCap: { LEARNING: 2, PRACTICE: 3, MASTERY: 4 },
            maxLevel: { add: 4, sub: 4, mul: 3, div: 3, order: 4, wp_add: 3, wp_sub: 3, wp_mul: 3, wp_div: 3, wp2: 3 },
            profiles: {},
            reset: function () { this.profiles = {}; },
            get: function (key) { if (!this.profiles[key]) this.profiles[key] = { level: 1, streak: 0, recent: [] }; return this.profiles[key]; },
            cap: function (key, zone) { return Math.min(this.maxLevel[key] || 3, this.zoneCap[zone] || 3); },
            levelFor: function (key, zone) { return Math.max(1, Math.min(this.get(key).level, this.cap(key, zone))); },
            record: function (key, zone, firstTry, errCode) {
                const p = this.get(key); const prev = p.recent[p.recent.length - 1];
                p.recent.push({ firstTry: firstTry, err: firstTry ? "" : (errCode || "") }); if (p.recent.length > 5) p.recent.shift();
                const need = key.indexOf("wp_") === 0 ? 1 : 2;               // 應用題四種運算輪流出，所以每種答對一次就能升級
                const wrongOf3 = p.recent.slice(-3).filter(x => !x.firstTry).length;
                if (firstTry) {
                    p.streak++;
                    if (p.streak >= need && wrongOf3 < 2) { p.level = Math.min(this.cap(key, zone), p.level + 1); p.streak = 0; }
                } else {
                    p.streak = 0;
                    if (prev && !prev.firstTry && prev.err && prev.err === errCode) p.level = Math.max(1, p.level - 1);  // 同一種錯連續兩題 → 退一級做補救
                }
            }
        };

        const GameFlowController = {
            recent: [],
            state: { island: "", zone: "LEARNING", qIndex: 1, totalQ: 3, currentQ: null, attempts: 0, firstTryCorrects: 0, hintsUsed: 0, stars: 0, firstErr: "", lastStruggled: false, lastOp: null, bag: [], qStart: 0 },
            startIsland: function (islandCode, startZone) { this.state.island = ISLAND_ALIASES[islandCode] || islandCode; this.state.stars = 0; this.recent = []; this.enterZone(startZone || "LEARNING"); },
            enterZone: function (z) {
                const s = this.state; s.zone = z; s.qIndex = 1; s.attempts = 0; s.firstTryCorrects = 0; s.hintsUsed = 0; s.totalQ = (z === "LEARNING") ? 3 : (z === "PRACTICE" ? 5 : 10);
                s.firstErr = ""; s.lastStruggled = false; s.lastOp = null; s.bag = []; AdaptiveEngine.reset();
            },
            // 應用題：加減乘除隨機輪流（一輪四種都會出現）；上一題卡很久就再出同一種運算
            pickWordOp: function () {
                const s = this.state;
                if (s.lastStruggled && s.lastOp) return s.lastOp;
                if (s.bag.length === 0) {
                    const b = MathEngineV2.shuffle(["+", "-", "*", "/"]);
                    if (b[b.length - 1] === s.lastOp) { const t = b[0]; b[0] = b[b.length - 1]; b[b.length - 1] = t; }
                    s.bag = b;
                }
                return s.bag.pop();
            },
            loadNextQuestion: function () {
                const s = this.state; s.attempts = 0; s.wrongs = 0; s.firstErr = ""; s.qStart = Date.now(); s.adaptiveReason = ""; s.remedialQ = false; s.phase = 1; s.failStep = 0;
                let key, wpOp = null, plan = null, q = null;
                if (s.island === "應用題島") {
                    plan = WP2Policy.next(WP2.state, s.zone, !!FEATURES.twoStepWordProblems);
                    if (plan.kind === "two") { q = TwoStepEngine.generate(TwoStepEngine.tierFor(WP2.state.stage), plan.template, this.recent); if (q) { s.adaptiveReason = plan.reason || ""; } }
                    if (!q) { wpOp = plan.op || this.pickWordOp(); s.adaptiveReason = plan.reason || ""; s.remedialQ = !!plan.remedial; key = "wp_" + OP_KEY[wpOp]; }
                } else { key = CONCEPT_KEY[s.island] || "add"; }
                if (!q) {
                    const level = AdaptiveEngine.levelFor(key, s.zone);
                    for (let k = 0; k < 20; k++) { q = MathEngineV2.generateQuestion(s.island, level, wpOp); if (this.recent.indexOf(q.fingerprint) === -1) break; }
                }
                this.recent.push(q.fingerprint); if (this.recent.length > 20) this.recent.shift();
                s.currentQ = q; s.lastOp = q.isTwoStep ? null : wpOp;
            },
            // 一題「完成」（單步驟答對 / 兩步驟全部完成）的共同收尾：星星、燈塔、進度
            _complete: function (q, firstTry, res) {
                const s = this.state;
                if (firstTry) s.firstTryCorrects++;
                AdaptiveEngine.record(q.operation, s.zone, firstTry, s.firstErr);
                s.lastStruggled = !firstTry;
                if (!firstTry && s.firstErr && ERROR_DICT[s.firstErr]) res.msg = `✅ 訂正成功！你修正了「${ERROR_DICT[s.firstErr].label}」，很棒！`;
                if (s.qIndex < s.totalQ) { s.qIndex++; res.nextAct = "NEXT_Q"; return; }
                let rate = s.firstTryCorrects / s.totalQ; let hintRate = s.hintsUsed / s.totalQ;
                let earned = 1; if (rate >= 0.7) earned = 2; if (rate >= 0.9 && hintRate <= 0.2) earned = 3;
                res.earnedStars = earned; s.stars = earned;
                const lhBefore = LighthouseSystem.stateOf(s.island);
                let recordObj = { stars: earned, accuracy: Math.round(rate * 100), date: new Date().toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) };
                if (!currentUser.progress[s.island]) currentUser.progress[s.island] = { LEARNING: [], PRACTICE: [], MASTERY: [] };
                if (!Array.isArray(currentUser.progress[s.island][s.zone])) currentUser.progress[s.island][s.zone] = [];
                currentUser.progress[s.island][s.zone].push(recordObj);
                LighthouseSystem.noteChange(s.island, lhBefore, LighthouseSystem.stateOf(s.island));
                currentUser.total_stars = ProgressSystem.calcTotal(currentUser.progress);
                res.nextAct = "FINISH"; res.msg = `🎉 完成本區挑戰！\n答對率 ${Math.round(rate * 100)}%，獲得 ${earned} 顆星！\n點擊下方按鈕領取獎勵！`;
            },
            // 兩步驟題送出：guided（phase 1 → phase 2）或 merged（一次送出）
            submitTwoStep: function (sub) {
                const s = this.state; const q = s.currentQ; s.attempts++;
                const phase = sub.mode === "guided" ? sub.phase : 0;
                const d = TwoStepEngine.diagnose(q, sub, phase);
                const res = { isCorrect: false, phaseDone: false, msg: "", hintLvl: 0, highlight: false, nextAct: "RETRY", errCode: d.code || "", earnedStars: 0, studentAnswer: d.studentAnswer, studentExpression: d.studentExpression, step: phase || 0, stepCount: 2, mode: sub.mode };
                if (d.kind === "phase1ok") { res.phaseDone = true; res.errCode = "CORRECT"; res.msg = `✅ 第一步正確！${q.steps[0].expr} = ${q.steps[0].result}\n接下來：${q.steps[1].ask}`; return res; }
                if (d.kind === "solved") {
                    res.isCorrect = true; res.errCode = "CORRECT"; res.msg = "🎉 太棒了！兩個步驟都正確！";
                    const firstTry = s.wrongs === 0; res.firstTry = firstTry;
                    const rec = WP2Policy.recordTwo(WP2.state, { template: q.template_id, firstTry: firstTry, hint3: s.wrongs >= 3, failStep: s.failStep });
                    res.adaptiveReason = rec.demoted ? rec.reason : s.adaptiveReason;
                    this._complete(q, firstTry, res);
                    return res;
                }
                // 答錯
                s.wrongs++; if (!s.firstErr) s.firstErr = d.code; if (!s.failStep) s.failStep = (d.code.indexOf("STEP1") >= 0) ? 1 : 2;
                res.hintLvl = Math.min(s.wrongs, 3); if (res.hintLvl === 1) s.hintsUsed++;
                res.msg = HintEngine.build(q, d.code, res.hintLvl, s.zone); res.highlight = res.hintLvl >= 2 && s.zone !== "MASTERY" || res.hintLvl === 3;
                res.adaptiveReason = s.adaptiveReason; return res;
            },
            submitAnswer: function (ans, op) {
                const s = this.state; if (s.island !== "應用題島") { op = null; } s.attempts++;
                const q = s.currentQ;
                const diag = MathEngineV2.diagnoseError(q, op, ans);
                const res = { isCorrect: diag.isCorrect, msg: diag.message || "", hintLvl: 0, highlight: false, nextAct: "RETRY", errCode: diag.errorCode, earnedStars: 0 };

                if (diag.isCorrect) {
                    const firstTry = s.attempts === 1; res.firstTry = firstTry;
                    if (q.isWord) WP2Policy.recordSingle(WP2.state, { op: q.params.op, firstTry: firstTry, hints: Math.min(3, s.attempts - 1), remedial: s.remedialQ });
                    res.adaptiveReason = s.adaptiveReason;
                    this._complete(q, firstTry, res);
                } else {
                    if (!s.firstErr && diag.errorCode !== "ERR_INPUT_EMPTY") s.firstErr = diag.errorCode;
                    res.hintLvl = Math.min(s.attempts, 3); s.wrongs = (s.wrongs || 0) + 1; res.adaptiveReason = s.adaptiveReason;
                    if (res.hintLvl === 1) s.hintsUsed++;
                    res.msg = HintEngine.build(q, diag.errorCode, res.hintLvl, s.zone);
                    res.highlight = (res.hintLvl === 2 && s.zone !== "MASTERY") || res.hintLvl === 3;
                }
                return res;
            }
        };

        // ==========================================================================
        //  兩步驟應用題（P2）：設定、題庫、驗證器、診斷、晉降階策略、介面
        //  範圍：國小四年級整數四則；除法一定整除；任何步驟都不會出現負數／小數／分數；括號只用圓括號