/* 燈塔狀態推導 */
        // ==========================================================================
        //  燈塔：由「已儲存的學習進度」推導，不另存一份容易失同步的數值
        //  litCount：完成幾個學習區（每區至少 1 星才算完成）→ 0~3 盞燈
        //  perfectGlow：三區合計 9 星
        // ==========================================================================
        const LighthouseSystem = {
            pending: null, timer: null,
            deriveState: function (islandProgress) {
                const prog = islandProgress || {}; let lit = 0, stars = 0;
                LIGHTHOUSE_CONFIG.zones.forEach(function (z) {
                    const best = ProgressSystem.getBestStar(prog[z]); const s = Math.max(0, Math.min(3, best || 0));
                    stars += s; if (s >= 1) lit++;
                });
                return { litCount: lit, earnedStars: stars, islandIlluminated: lit === 3, perfectGlow: stars === 9 };
            },
            stateOf: function (island) { return this.deriveState(currentUser && currentUser.progress ? currentUser.progress[island] : null); },
            // 進度剛改變時，比較前後狀態，決定要播哪一種一次性慶祝
            noteChange: function (island, before, after) {
                if (after.perfectGlow && !before.perfectGlow) this.pending = { island: island, kind: 'perfect', lit: after.litCount };
                else if (after.litCount > before.litCount) this.pending = { island: island, kind: after.litCount === 3 ? 'island' : 'lamp', lit: after.litCount };
            },
            celebrate: function () {
                const p = this.pending; this.pending = null; if (!p) return;
                const box = document.getElementById('lh-celebrate'); const txt = document.getElementById('lh-celebrate-text'); if (!box || !txt) return;
                const msg = p.kind === 'perfect' ? '九顆星全收集！燈塔戴上金色星冠' : (p.kind === 'island' ? '三盞燈全亮，整座島發光了！' : (p.lit === 1 ? '第一盞燈亮了！燈塔 1／3' : '第二盞燈亮了！燈塔 2／3'));
                try { const art = document.getElementById('lh-celebrate-art'); if (art) art.innerHTML = UIKit.lighthouseHTML(p.kind === 'lamp' ? p.lit : 3, { crown: p.kind === 'perfect', label: msg }); } catch (e) { /* 測試環境 */ }
                txt.innerText = msg; box.style.display = 'flex'; SoundFx.chime(p.kind === 'lamp' ? p.lit : 3);
                const map = { "加法島": "node-add", "減法島": "node-sub", "乘法島": "node-mul", "除法島": "node-div", "應用題島": "node-wp", "四則運算島": "node-ord" };
                const node = document.getElementById(map[p.island]); if (node) { node.classList.add('lh-pop'); }
                this.popNode = node; clearTimeout(this.timer);
                this.timer = setTimeout(function () { LighthouseSystem.skip(); }, p.kind === 'lamp' ? LIGHTHOUSE_CONFIG.lampMs : LIGHTHOUSE_CONFIG.celebrateMs);
            },
            skip: function () {
                clearTimeout(this.timer); const box = document.getElementById('lh-celebrate'); if (box) box.style.display = 'none';
                if (this.popNode) { this.popNode.classList.remove('lh-pop'); this.popNode = null; }
            }
        };
