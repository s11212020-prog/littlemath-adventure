/* 學習區動畫引擎（階段 6：畫面改用原創 SVG 道具＋CSS 類別；播放順序、旁白、字幕、完成判斷完全沿用） */
        // ==========================================================================
        //  動畫引擎：每一幕＝「字幕 + 旁白（等 onend 再停頓）+ 視覺動作」，三者都完成才進下一幕
        //  runId：每次播放／跳過／重播都會換新，舊的非同步流程醒來後發現過期就直接結束
        //  畫面：位置一律用「舞台寬高的百分比」，道具大小用舞台寬度 cqw，任何螢幕尺寸都不會跑版
        //  圖：全部來自 prop-art.js（Props.xxx），日後換成精緻圖檔不用改這個檔案
        // ==========================================================================
        const AnimationEngine = {
            isPlaying: false, runId: 0, island: '', captionsOn: true,
            alive: function (rid) { return this.isPlaying && rid === this.runId; },
            stopAll: function () { this.isPlaying = false; this.runId++; Narrator.cancelAll(); },
            // 視覺用的等待（只用來排動畫節奏，不用來決定旁白是否結束）
            wait: async function (ms, rid) { await delay(ms); return this.alive(rid); },
            step: async function (rid, text, act) {
                if (!this.alive(rid)) return false;
                const sub = document.getElementById('theater-sub'); sub.innerText = text; sub.style.visibility = this.captionsOn ? 'visible' : 'hidden';
                const speech = Narrator.say(text);                  // 字幕與語音同時開始
                if (act) { try { await act(); } catch (e) { console.error('[animation act]', e); } }
                const ok = await speech;                            // 一定等到 ended + 自然停頓
                return ok && this.alive(rid);
            },
            toggleCaptions: function () {
                this.captionsOn = !this.captionsOn; const sub = document.getElementById('theater-sub'); if (sub) sub.style.visibility = this.captionsOn ? 'visible' : 'hidden';
                const b = document.getElementById('btn-anim-caption'); if (b) { try { b.setAttribute('aria-pressed', this.captionsOn ? 'true' : 'false'); } catch (e) { /* 測試環境 */ } }
                const l = document.getElementById('anim-caption-label'); if (l) l.innerText = this.captionsOn ? '字幕：開' : '字幕：關';
            },
            replay: function () { if (this.island) this.play(this.island); },

            /* ---------- 小工具：道具、圖示（任何一個失敗都不影響旁白與流程） ---------- */
            prop: function (name, arg) { try { return Props.html(name, arg); } catch (e) { return ''; } },
            icon: function (name, size) { try { return UIKit.icon(name, { size: size || 28 }); } catch (e) { return ''; } },
            actor: function (id, art, left, top, extra) { return `<div id="${id}" class="th-actor ${extra || ''}" style="left:${left}%;top:${top}%;">${art}</div>`; },
            eq: function (text) { const e = document.getElementById('th-eq'); if (e) { e.innerText = text; e.classList.add('is-on'); } },

            play: async function(island) {
                this.stopAll(); this.isPlaying = true; this.island = island; const rid = this.runId; QF.state = 'ANIMATION';
                document.getElementById('animation-view').style.display = 'flex'; document.getElementById('interactive-view').style.display = 'none'; document.getElementById('word-problem-view').style.display = 'none';
                const stage = document.getElementById('theater-stage'); stage.classList.toggle('is-wp', island === "應用題島"); const sub = document.getElementById('theater-sub'); sub.style.visibility = this.captionsOn ? 'visible' : 'hidden';
                const nextBtn = document.getElementById('btn-anim-next'); if (nextBtn) nextBtn.classList.remove('is-visible');
                const S = (t, a) => this.step(rid, t, a); const W = (ms) => this.wait(ms, rid); const $ = (id) => document.getElementById(id);
                const P = (n, a) => this.prop(n, a); const A = (id, art, l, t, x) => this.actor(id, art, l, t, x); const EQ = (t) => this.eq(t);
                let finished = false;

                if (island === "加法島") {
                    stage.innerHTML = `<div class="th-scene th-scene--add"><div class="th-eq" id="th-eq" aria-hidden="true"></div><div class="th-pond">${P('pond')}</div>` +
                        A('f1', P('frog'), 8, 26) + A('f2', P('frog'), 22, 26) + A('f3', P('frog'), 36, 26) + A('f4', P('frog'), 104, 26) + A('f5', P('frog'), 118, 26) + `</div>`;
                    finished = await S("「池塘裡原本有 3 隻青蛙...」", async () => { await W(500); ['f1','f2','f3'].forEach(id => $(id).classList.add('is-in')); EQ('3'); })
                        && await S("「草叢裡又跳來了 2 隻青蛙！」", async () => { $('f4').classList.add('is-in'); $('f4').style.left = '58%'; $('f5').classList.add('is-in'); $('f5').style.left = '72%'; EQ('3 ＋ 2'); })
                        && await S("「把它們合起來，一共有 5 隻青蛙！ (3 + 2 = 5)」", async () => { [18, 30, 42, 54, 66].forEach((l, i) => { const f = $(`f${i + 1}`); f.style.left = l + '%'; f.style.top = '50%'; f.classList.add('is-hop'); }); EQ('3 ＋ 2 ＝ 5'); });
                } else if (island === "減法島") {
                    stage.innerHTML = `<div class="th-scene th-scene--sub"><div class="th-eq" id="th-eq" aria-hidden="true"></div><div class="th-crate">${P('crate')}</div>` +
                        A('t1', P('toyBlock'), 8, 20) + A('t2', P('toyBlock'), 24, 20) + A('t3', P('toyCar'), 40, 22) + A('t4', P('toyCar'), 8, 56) + A('t5', P('toyBall'), 24, 56, 'th-front') + A('t6', P('toyBall'), 40, 56, 'th-front') + `</div>`;
                    finished = await S("「地毯上原本有 6 件玩具...」", async () => { await W(500); for (let i = 1; i <= 6; i++) $(`t${i}`).classList.add('is-in'); EQ('6'); })
                        && await S("「把其中 2 件玩具收進箱子 (拿走)。」", async () => { $('t5').style.left = '70%'; $('t5').style.top = '40%'; $('t6').style.left = '82%'; $('t6').style.top = '40%'; EQ('6 － 2'); })
                        && await S("「外面還剩下 4 件玩具！ (6 - 2 = 4)」", async () => { $('t5').classList.add('is-packed'); $('t6').classList.add('is-packed'); ['t1','t2','t3','t4'].forEach(id => $(id).classList.add('is-keep')); EQ('6 － 2 ＝ 4'); });
                } else if (island === "乘法島") {
                    const cell = (i) => `<div class="th-potcell"><div class="th-seedwrap" id="p${i}">${P('seeds')}</div>${P('pot')}</div>`;
                    stage.innerHTML = `<div class="th-scene th-scene--mul"><div class="th-eq" id="th-eq" aria-hidden="true"></div><div class="th-row">${cell(1)}${cell(2)}${cell(3)}${cell(4)}</div></div>`;
                    finished = await S("「花園裡準備了 4 個花盆 (4 組)。」", async () => { EQ('4 組'); })
                        && await S("「每個花盆都要放 3 顆種子，要一樣多喔！」", async () => { EQ('每組 3 顆'); for (let i = 1; i <= 4; i++) { if (!(await W(800))) return; $(`p${i}`).classList.add('is-in'); } })
                        && await S("「4 組，每組 3 顆，一共有 12 顆！ (4 × 3 = 12)」", async () => { EQ('4 × 3 ＝ 12'); });
                } else if (island === "除法島") {
                    const COL = ['#FF7AA2', '#FFD166', '#5ED1C0'];
                    const candies = (n) => { let h = ''; for (let i = 0; i < n; i++) h += P('candy', COL[i % 3]); return h; };
                    const plate = (id) => `<div class="th-plate">${P('plate')}<div class="th-plate-candies" id="${id}"></div></div>`;
                    stage.innerHTML = `<div class="th-scene th-scene--div"><div class="th-eq" id="th-eq" aria-hidden="true"></div><div class="th-pile" id="candies">${candies(12)}</div><div class="th-row th-row--plates">${plate('pl1')}${plate('pl2')}${plate('pl3')}${plate('pl4')}</div></div>`;
                    finished = await S("「桌上有 12 顆糖果，要平均分給 4 個盤子。」", async () => { EQ('12 ÷ 4'); })
                        && await S("「一人一顆輪流分，直到全部分完為止！」", async () => {
                            let remain = 12; const got = [0, 0, 0, 0, 0];
                            for (let round = 1; round <= 3; round++) for (let i = 1; i <= 4; i++) {
                                if (!(await W(400))) return;
                                $(`pl${i}`).innerHTML += P('candy', COL[(12 - remain) % 3]); got[i]++; remain--;
                                $('candies').innerHTML = candies(remain);
                            }
                        })
                        && await S("「糖果分完了，每個盤子都是 3 顆！ (12 ÷ 4 = 3)」", async () => { EQ('12 ÷ 4 ＝ 3'); ['pl1','pl2','pl3','pl4'].forEach(id => $(id).classList.add('is-full')); });
                } else if (island === "應用題島") {
                    finished = await this.playWordProblem(rid, stage, S, W);
                } else if (island === "四則運算島") {
                    const stepPills = `<ol class="th-steps" aria-hidden="true"><li id="ts1" class="th-steps__li">${this.icon('parens', 24)}<span>括號</span></li><li id="ts2" class="th-steps__li">${this.icon('times', 24)}<span>先乘除</span></li><li id="ts3" class="th-steps__li">${this.icon('next', 24)}<span>左到右</span></li></ol>`;
                    stage.innerHTML = `<div class="th-scene th-scene--mix"><div class="th-col th-col--l">${P('column')}</div><div class="th-col th-col--r">${P('column')}</div>${stepPills}` +
                        `<div class="th-expr"><div class="th-tile" id="tc1">18</div><div class="th-op">＋</div><div class="th-tile" id="tc2">4</div><div class="th-op" id="tc-mul">×</div><div class="th-tile" id="tc3">3</div></div></div>`;
                    const now = (n) => [1, 2, 3].forEach(i => { const e = $('ts' + i); if (e) { e.classList.remove('is-now'); if (i < n) e.classList.add('is-past'); } });
                    const lit = (n) => { now(n); const e = $('ts' + n); if (e) e.classList.add('is-now'); };
                    finished = await S("「神殿裡的運算，必須找出優先權！」", null)
                        && await S("「第一步：先找括號！沒有括號的話...」", async () => { lit(1); })
                        && await S("「第二步：先乘除！掃描並優先處理乘法或除法。」", async () => { lit(2); if (!(await W(1500))) return; $('tc2').classList.add('is-focus'); $('tc3').classList.add('is-focus'); $('tc-mul').classList.add('is-focus'); })
                        && await S("「第三步：由左到右算！先算 4 乘以 3，最後再加 18！」", async () => { lit(3); $('tc2').innerText = "12"; $('tc2').classList.remove('is-focus'); $('tc2').classList.add('is-result'); $('tc-mul').classList.add('is-gone'); $('tc3').classList.add('is-gone'); });
                } else { finished = true; }

                if (!this.alive(rid) || !finished) return;
                if (nextBtn) nextBtn.classList.add('is-visible');
            },
            // 應用題島動畫：依序介紹 加、減、乘、除 四種關鍵字（全部都會介紹）
            playWordProblem: async function(rid, stage, S, W) {
                const items = [
                    { op: 'add', sym: "＋", name: "加法", parts: ["小明有 12 張貼紙，", ["又拿了"], " 5 張，", ["一共"], "有幾張貼紙？"], find: "「第 1 種：加法。先看這題的關鍵字！」", explain: "「看到『又拿了』、『一共』，東西合起來變多了，用加法！」", more: "加法常見關鍵字：又、再、合起來、一共、總共" },
                    { op: 'sub', sym: "－", name: "減法", parts: ["桌上有 25 塊餅乾，", ["被拿走"], " 8 塊，", ["還剩下"], "幾塊餅乾？"], find: "「第 2 種：減法。找找看關鍵字！」", explain: "「看到『被拿走』、『還剩下』，東西變少了，用減法！比較『多多少、少多少』也是減法喔！」", more: "減法常見關鍵字：拿走、送給、用掉、剩下、還剩、比…多／少幾個" },
                    { op: 'mul', sym: "×", name: "乘法", parts: ["一盒巧克力有 6 顆，買了 4 盒，", ["共有"], "幾顆巧克力？"], hi: ["一盒"], find: "「第 3 種：乘法。注意『一盒』的數量都一樣！」", explain: "「每一盒、每一組都一樣多，要算全部『共有』多少，用乘法！」", more: "乘法常見關鍵字：每（一）盒／組／排…都一樣多，求共有、一共" },
                    { op: 'div', sym: "÷", name: "除法", parts: ["老師有 24 張貼紙，", ["平分給"], " 4 個人，", ["每人分到"], "幾張？"], find: "「第 4 種：除法。看看有沒有『平分』？」", explain: "「看到『平分給』、『每人分到』，要公平分配，用除法！」", more: "除法常見關鍵字：平分、平均分、每人分到、每幾個裝一袋" }
                ];
                const chips = (cur) => items.map((it, i) => `<span id="wpchip${i}" class="th-chip is-${it.op} ${cur === undefined ? 'is-wait' : (i < cur ? 'is-past' : (i === cur ? 'is-now' : 'is-wait'))}">${it.sym} ${it.name}</span>`).join("");
                const wrap = (inner, cur) => `<div class="th-wp"><div class="th-chips">${chips(cur)}</div>${inner}</div>`;
                const kwSpan = (t) => `<span class="th-kw wp-kw">${t}</span>`;

                stage.innerHTML = wrap(`<div class="th-wp__title">${this.icon('book', 36)}<span>應用題＝用文字說故事</span></div>`);
                if (!(await S("「應用題是用文字說故事。第一步，先找『關鍵字』！今天要認識加、減、乘、除四種關鍵字。」", null))) return false;

                for (let i = 0; i < items.length; i++) {
                    const it = items[i]; let html = "";
                    it.parts.forEach(p => { html += Array.isArray(p) ? kwSpan(p[0]) : p; });
                    if (it.hi) it.hi.forEach(h => { html = html.replace(h, kwSpan(h)); });
                    stage.innerHTML = wrap(`<div class="th-wp__story">${html}</div><div id="wp-more" class="th-wp__more">${it.more}</div>`, i);
                    if (!(await S(it.find, null))) return false;
                    if (!(await S(it.explain, async () => {
                        document.querySelectorAll('.th-kw').forEach(el => el.classList.add('is-lit'));
                        const m = document.getElementById('wp-more'); if (m) m.classList.add('is-on');
                    }))) return false;
                }
                const rows = [["add", "＋ 加法", "又拿了、一共、合起來"], ["sub", "－ 減法", "拿走、剩下、比…多"], ["mul", "× 乘法", "每盒都一樣多、共有"], ["div", "÷ 除法", "平分給、每人分到"]];
                stage.innerHTML = `<div class="th-wp th-wp--sum">` + rows.map(r => `<div class="th-sum is-${r[0]}"><strong>${r[1]}</strong><span>${r[2]}</span></div>`).join("") + `</div>`;
                return await S("「記住這四種關鍵字，就能判斷要用加、減、乘、還是除！現在換你試試看了！」", null);
            }
        };

        // 結束動畫（按「換我試試看」或「跳過動畫」）。冪等：重複呼叫不會多切一題
        function endAnimation() {
            const av = document.getElementById('animation-view'); if (!av || av.style.display !== 'flex') return;
            AnimationEngine.stopAll(); av.style.display = 'none';
            const nb = document.getElementById('btn-anim-next'); if (nb) nb.classList.remove('is-visible');
            GameFlowController.loadNextQuestion(); renderUI();
        }
