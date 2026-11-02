/* 集中設定與旁白控制器 */
        // ==========================================================================
        //  集中設定（所有可調整的數值都放這裡，不要散落在各處）
        // ==========================================================================
        const FEATURES = { twoStepWordProblems: true };          // 兩步驟應用題開關（燈塔、Enter、配音不依賴它）
        const NARRATION_CONFIG = {
            lang: 'zh-TW', rate: 0.85, pitch: 1,
            pauseMs: 600,                 // 旁白 ended 之後的自然停頓（450~700ms）
            watchdogExtraMs: 1800,        // 預估最長時長之外再加的備援時間（1.5~2 秒）
            estMsPerChar: 420,            // 備援用：每字最長預估毫秒（rate=1 時）
            noTtsMsPerChar: 260,          // 瀏覽器完全不支援語音時，字幕停留的估計時間
            voiceWaitMs: 1200             // 等待語音清單載入的上限
        };
        const KEY_CONFIG = { lockMs: 350 };                       // Enter 防連按（300~500ms）
        const LIGHTHOUSE_CONFIG = { zones: ['LEARNING', 'PRACTICE', 'MASTERY'], celebrateMs: 2200, lampMs: 1500 };

        // ==========================================================================
        //  旁白控制器：以語音 onend 為主要完成訊號，結束後再停頓才換下一句
        //  舊版問題：每次 speak 前都 cancel()，上一句還沒念完就被切掉（末 3~4 字消失），
        //  而且動畫用固定 delay() 換場，語速一慢就搶先轉場。
        // ==========================================================================
        const Narrator = {
            epoch: 0, seq: 0, queue: Promise.resolve(), cur: null, voiceP: null, log: [],
            supported: function () { try { return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; } catch (e) { return false; } },
            // 字幕保留原文；念出來的版本把算式符號換成口語、移除表情符號與括號
            toSpoken: function (t) {
                let s = String(t == null ? '' : t).replace(/[「」『』]/g, '');
                s = s.replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, '');
                s = s.replace(/[＋+]/g, ' 加 ').replace(/[－−]/g, ' 減 ').replace(/(\d)\s*-\s*(\d)/g, '$1 減 $2').replace(/[×✖]/g, ' 乘以 ').replace(/[÷➗]/g, ' 除以 ').replace(/[＝=]/g, ' 等於 ');
                s = s.replace(/[()（）]/g, ' ').replace(/\s+/g, ' ').trim();
                if (s && !/[。！？!?，,]$/.test(s)) s += '。';
                return s;
            },
            getVoice: function () {
                if (this.voiceP) return this.voiceP;
                const synth = window.speechSynthesis; const self = this;
                const pick = function () { let vs = []; try { vs = synth.getVoices ? synth.getVoices() : []; } catch (e) { } return vs.find(function (v) { return /^zh[-_]TW/i.test(v.lang); }) || vs.find(function (v) { return /^zh/i.test(v.lang); }) || null; };
                this.voiceP = new Promise(function (resolve) {
                    const v = pick(); if (v || !synth.addEventListener) return resolve(v);
                    let done = false; const fin = function () { if (done) return; done = true; resolve(pick()); };
                    synth.addEventListener('voiceschanged', fin, { once: true }); setTimeout(fin, NARRATION_CONFIG.voiceWaitMs);
                }).then(function (v) { if (!v) self.voiceP = null; return v; });
                return this.voiceP;
            },
            // 取消全部（只有學生按跳過／離開動畫頁／重播才呼叫）
            cancelAll: function () { this.epoch++; this.cur = null; try { if (this.supported()) window.speechSynthesis.cancel(); } catch (e) { } },
            // 念一句。resolve(true)＝完整念完且停頓結束；resolve(false)＝被取消（舊事件，呼叫端必須停止推進場景）
            say: function (text) {
                const epoch = this.epoch; const id = ++this.seq; const self = this;
                const run = function () { return self._play(text, epoch, id); };
                const p = this.queue.then(run, run);          // 前一句沒結束就排隊，絕不同時播放
                this.queue = p.catch(function () { });
                return p;
            },
            _play: async function (text, epoch, id) {
                if (epoch !== this.epoch) return false;
                const cfg = NARRATION_CONFIG; const spoken = this.toSpoken(text); const self = this;
                const rec = { id: id, text: text, spoken: spoken, startAt: null, endedAt: null, transitionAt: null, how: '' }; this.log.push(rec); if (this.log.length > 200) this.log.shift();
                if (!this.supported()) {
                    rec.startAt = Date.now(); await delay(spoken.length * cfg.noTtsMsPerChar); rec.endedAt = Date.now(); rec.how = 'no-tts';
                } else {
                    const voice = await this.getVoice(); if (epoch !== this.epoch) return false;
                    const how = await new Promise(function (resolve) {
                        let done = false; let wd = null;
                        const finish = function (h) { if (done) return; done = true; clearTimeout(wd); resolve(h); };
                        const u = new SpeechSynthesisUtterance(spoken); u.lang = cfg.lang; u.rate = cfg.rate; u.pitch = cfg.pitch; if (voice) u.voice = voice;
                        u.onstart = function () { rec.startAt = Date.now(); };
                        u.onend = function () { finish('end'); };
                        u.onerror = function (e) { finish(epoch !== self.epoch ? 'cancel' : 'error:' + (e && e.error)); };
                        wd = setTimeout(function () { console.warn('[Narrator] watchdog：onend 沒有觸發', id); finish('watchdog'); }, spoken.length * cfg.estMsPerChar / cfg.rate + cfg.watchdogExtraMs);
                        self.cur = u; rec.startAt = Date.now();             // 保留參照，避免瀏覽器回收物件造成 onend 不觸發
                        try { window.speechSynthesis.speak(u); } catch (e) { finish('error:speak'); }
                    });
                    rec.endedAt = Date.now(); rec.how = how;
                    if (epoch !== this.epoch) return false;
                    if (how === 'watchdog') { try { window.speechSynthesis.cancel(); } catch (e) { } }
                    if (how.indexOf('error') === 0) await delay(spoken.length * cfg.noTtsMsPerChar);   // 語音失敗：讓字幕停留足夠閱讀時間，不卡住
                }
                if (epoch !== this.epoch) return false;
                await delay(cfg.pauseMs); if (epoch !== this.epoch) return false;
                rec.transitionAt = Date.now(); return true;
            },
            // 學生主動按「🔊 朗讀」：直接取代目前的聲音
            speakNow: function (text) { this.cancelAll(); return this.say(text); }
        };

        // 簡單鈴音（WebAudio，不影響旁白）
        const SoundFx = {
            ctx: null,
            chime: function (level) {
                try {
                    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
                    this.ctx = this.ctx || new AC(); const c = this.ctx; const notes = level === 1 ? [880] : (level === 2 ? [660, 880] : [660, 880, 1100, 1320]);
                    notes.forEach(function (f, i) {
                        const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + i * 0.18; o.type = 'sine'; o.frequency.value = f;
                        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
                        o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + 0.55);
                    });
                } catch (e) { }
            }
        };
