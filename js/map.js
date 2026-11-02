/* 進度計算與地圖特效 */
        const MAX_TOTAL_STARS = 54;
        const TITLE_LEVELS = [
            { min: 0, title: "數學小旅人" }, { min: 9, title: "數學探索家" }, { min: 18, title: "算術小勇士" }, { min: 27, title: "解題小隊長" },
            { min: 36, title: "數學小達人" }, { min: 45, title: "智慧領航員" }, { min: 54, title: "數學島守護者" }
        ];
        const ProgressSystem = {
            getBestStar: function(records) { if(!Array.isArray(records) || records.length === 0) return 0; return Math.max(...records.map(r => typeof r === 'object' ? r.stars : 0)); },
            calcTotal: function(prog) { let t = 0; ["加法島", "減法島", "乘法島", "除法島", "應用題島", "四則運算島"].forEach(i => { if (prog[i]) { t += this.getBestStar(prog[i]["LEARNING"]); t += this.getBestStar(prog[i]["PRACTICE"]); t += this.getBestStar(prog[i]["MASTERY"]); } }); return Math.min(t, 54); },
            /* 稱號：唯一的規則來源。海圖頂端、稱號航線面板（js/title-route.js）、新手導覽第 7 步都讀這一份（階段 8.1） */
            TITLE_LEVELS: TITLE_LEVELS,
            clampStars: function(t) { t = Math.floor(Number(t)); if (!isFinite(t) || t < 0) return 0; return Math.min(t, MAX_TOTAL_STARS); },
            levelIndex: function(t) { t = this.clampStars(t); let k = 0; for (let i = 0; i < TITLE_LEVELS.length; i++) { if (t >= TITLE_LEVELS[i].min) k = i; } return k; },
            getTitle: function(t) {
                t = this.clampStars(t); const k = this.levelIndex(t); const next = TITLE_LEVELS[k + 1];
                return { title: TITLE_LEVELS[k].title, nextMsg: next ? `再 ${next.min - t} 星升級！` : "已達最高榮譽！" };
            },
            /* 稱號航線需要的完整資訊（只計算，不寫入任何資料） */
            titleInfo: function(t) {
                t = this.clampStars(t); const k = this.levelIndex(t); const next = TITLE_LEVELS[k + 1] || null;
                return { total: t, max: MAX_TOTAL_STARS, index: k, current: TITLE_LEVELS[k], next: next, remain: next ? next.min - t : 0, isMax: !next,
                    nodes: TITLE_LEVELS.map(function(L, i) { return { min: L.min, title: L.title, status: i < k ? 'done' : (i === k ? 'current' : (i === k + 1 ? 'next' : 'future')), reached: t >= L.min }; }) };
            }
        };

        const EffectEngine = {
            shakeElement: function(id) { const el = document.getElementById(id); if(el) { el.classList.remove('apply-shake'); void el.offsetWidth; el.classList.add('apply-shake'); } },
            flyStar: async function() { const _st = document.getElementById('ui-island-stars'); if (_st) _st.innerText = GameFlowController.state.stars; const c = document.getElementById('star-animation-container'); const s = document.createElement('div'); s.className = 'flying-star'; s.innerHTML = UIKit.icon('star', { size: 96 }); c.appendChild(s); s.style.animation = 'starFly 1.5s ease-in-out forwards'; await delay(1500); c.innerHTML = ''; },
            updateMap: function() {
                if(!currentUser || !currentUser.progress) return;
                let ts = ProgressSystem.calcTotal(currentUser.progress); currentUser.total_stars = ts; 
                let tInfo = ProgressSystem.getTitle(ts);
                document.getElementById('ui-nickname').innerText = currentUser.nickname || '船員'; document.getElementById('ui-title').innerText = tInfo.title; document.getElementById('ui-total-stars').innerText = ts; document.getElementById('ui-next-title-hint').innerText = tInfo.nextMsg;
                document.getElementById('ui-my-avatar').innerHTML = (typeof RewardLook !== 'undefined' ? RewardLook.ownBust(currentUser.progress && currentUser.progress.avatar, 40) : AvatarKit.bustHTML(currentUser.progress && currentUser.progress.avatar, 40));
                if (typeof TitleRoute !== 'undefined') TitleRoute.syncButton(ts, tInfo);

                /* 六座島的狀態（已完成／進行中／尚未開始＋目前停靠）、燈塔、星數、小船、航線：階段 5 起由 js/sea-map.js 負責 */
                SeaMap.render();
                if (typeof Cabin !== 'undefined') Cabin.onMapShown();   /* 階段 9E-2：同步「船員小屋」入口與本人裝備（功能沒開放時什麼都不做） */
            }
        };
