/* 歷史紀錄、小船、島嶼入口彈窗、回地圖 */
        /* 冒險日誌（階段 8 改版）：只「讀」目前登入學生已載入的進度（currentUser.progress），不寫入、不補資料、不改排序。
           桌機／平板：表格；手機：直式卡片（兩份都由同一批資料產生，順序與內容完全相同）；沒有紀錄：原創插畫＋回海圖按鈕。 */
        const HISTORY_ISLANDS = ["加法島", "減法島", "乘法島", "除法島", "應用題島", "四則運算島"];
        const HISTORY_ACTIVITY = { "加法島": "加法計算", "減法島": "減法計算", "乘法島": "乘法計算", "除法島": "除法計算", "應用題島": "應用題", "四則運算島": "四則運算" };
        const HISTORY_ZONE_ACT = { LEARNING: "概念學習", PRACTICE: "互動練習", MASTERY: "掌握確認" };
        function historyRecords() {
            const allRecs = []; const prog = (currentUser && currentUser.progress) || {};
            for (const [isl, zones] of Object.entries(prog)) {
                if (typeof zones !== 'object' || zones === null) continue;
                for (const [z, records] of Object.entries(zones)) {
                    if (!Array.isArray(records)) continue;
                    let zZh = z === "LEARNING" ? "概念學習區" : (z === "PRACTICE" ? "互動練習區" : "掌握確認區");
                    records.forEach(rec => { if (typeof rec === 'object' && rec && rec.date) { allRecs.push({ isl: isl, zk: z, z: zZh, stars: rec.stars, acc: rec.accuracy, dateStr: rec.date, time: new Date(rec.date).getTime() }); } });
                }
            }
            allRecs.sort((a, b) => b.time - a.time);
            return allRecs;
        }
        function historyStarsHTML(n) {
            const k = Number(n) || 0; if (k <= 0) return '<span class="hj-done">完成</span>';
            try { return UIKit.starsHTML(Math.min(3, k), 3); } catch (e) { return escapeHTML(String(Math.min(3, k)) + ' 顆星'); }
        }
        function historyActivity(r) { return (HISTORY_ACTIVITY[r.isl] || r.isl) + "・" + (HISTORY_ZONE_ACT[r.zk] || r.z); }
        function historyLighthouse() {
            let lamps = 0, full = 0;
            HISTORY_ISLANDS.forEach(isl => { try { const st = LighthouseSystem.stateOf(isl); lamps += st.litCount; if (st.islandIlluminated) full++; } catch (e) { } });
            return { lamps: lamps, full: full };
        }
        function showHistoryScreen() {
            const cu = currentUser || {}; const $ = id => document.getElementById(id);
            $('ui-history-total').innerText = cu.total_stars;
            if ($('ui-history-nick')) $('ui-history-nick').innerText = cu.nickname || "船員";
            if ($('ui-history-user')) $('ui-history-user').innerText = cu.username ? "帳號：" + cu.username : "";
            if ($('ui-history-avatar')) { try { $('ui-history-avatar').innerHTML = (typeof RewardLook !== 'undefined' ? RewardLook.ownBust(cu.progress && cu.progress.avatar, 56) : AvatarKit.bustHTML(cu.progress && cu.progress.avatar, 56)); } catch (e) { $('ui-history-avatar').innerHTML = ""; } }
            const lh = historyLighthouse();
            if ($('ui-history-lh')) $('ui-history-lh').innerText = lh.lamps + "／18";
            if ($('ui-history-lh-note')) $('ui-history-lh-note').innerText = "點亮的燈塔層數（" + lh.full + "／6 座全亮）";
            const tbody = $('history-tbody'); const cards = $('history-cards'); tbody.innerHTML = ""; if (cards) cards.innerHTML = "";
            const allRecs = historyRecords(); const empty = $('history-empty'); const wrap = $('history-table-wrap');
            if (allRecs.length === 0) {
                if (wrap) wrap.hidden = true; if (cards) cards.hidden = true; if (empty) empty.hidden = false;
            } else {
                if (wrap) wrap.hidden = false; if (cards) cards.hidden = false; if (empty) empty.hidden = true;
                let rows = "", cs = "";
                allRecs.forEach(r => {
                    const accTxt = (r.acc === undefined || r.acc === null || r.acc === "") ? "—" : escapeHTML(String(r.acc)) + "%"; const act = escapeHTML(historyActivity(r)); const stars = historyStarsHTML(r.stars);
                    rows += `<tr><td class="hj-time">${escapeHTML(r.dateStr)}</td><td class="hj-isl">${escapeHTML(r.isl)}</td><td>${escapeHTML(r.z)}</td><td>${act}</td><td class="hj-acc">${accTxt}</td><td class="hj-stars">${stars}</td></tr>`;
                    cs += `<li class="hj-card"><div class="hj-card__top"><span class="hj-card__isl">${escapeHTML(r.isl)}</span><span class="hj-card__stars">${stars}</span></div><dl class="hj-card__dl"><div><dt>作答時間</dt><dd>${escapeHTML(r.dateStr)}</dd></div><div><dt>學習區域</dt><dd>${escapeHTML(r.z)}</dd></div><div><dt>題目或活動類型</dt><dd>${act}</dd></div><div><dt>答對率</dt><dd class="hj-acc">${accTxt}</dd></div></dl></li>`;
                });
                tbody.innerHTML = rows; if (cards) cards.innerHTML = cs;
            }
            switchScreen('screen-history');
        }

        /* 點島嶼：小船沿航線開到那座島（回傳 Promise，到港才開啟島嶼彈窗；中途改去別座島就不會誤開）。
           手機／平板上點到沒對準中央的島，只會先把它滑到中央。減少動態時小船直接出現在島邊，不播長距離移動。 */
        function triggerBoat(island, nodeEl) {
            SeaMap.paintBoat();
            SeaMap.go(island).then(function (arrived) { if (arrived && currentUser) showIslandModal(island); });
        }

        /* 島嶼入口（港口）：選擇學習區／練習區／掌握確認區。階段 6 起畫面由 js/island-ui.js 負責；解鎖規則不變：
           學習區隨時可進，練習區要學習區至少 1 星，掌握確認區要練習區至少 1 星。 */
        function showIslandModal(island) {
            selectedIslandForModal = island; IslandUI.openPort(island);
        }

        function enterIslandFromModal(targetZone) {
            IslandUI.closePort(true);
            const sg = document.getElementById('screen-game');
            try {
                // 先把題目與狀態準備好；只要失敗，就不會切換畫面，也不會留下半開的畫面
                GameFlowController.startIsland(selectedIslandForModal, targetZone); LighthouseSystem.skip(); QuestionKeys.attach();
                IslandUI.hideResult(); IslandUI.setTheme(selectedIslandForModal); IslandUI.paintHUD();
                const ps = document.getElementById('ui-progress-path'); if (ps) ps.innerHTML = '';
                switchScreen('screen-game');
                try { const sc = document.getElementById('screen-game'); if (sc && sc.scrollTo) sc.scrollTo(0, 0); } catch (e) { /* 測試環境 */ }
                if (targetZone === "LEARNING") {
                    AnimationEngine.play(selectedIslandForModal).catch(e => console.error('[animation]', e));
                } else {
                    AnimationEngine.isPlaying = false;
                    document.getElementById('animation-view').style.display = 'none';
                    GameFlowController.loadNextQuestion(); renderUI();
                }
            } catch (err) {
                console.error('[enterIslandFromModal]', err);
                alert('進入島嶼失敗，請按 Ctrl+F5 重新整理後再試。');
                switchScreen('screen-map');
            }
        }

        function backToMap() { IslandUI.hideResult(); AnimationEngine.stopAll(); QF.state = 'IDLE'; QF.busy = false; QuestionKeys.detach(); EffectEngine.updateMap(); switchScreen('screen-map'); LighthouseSystem.celebrate(); }
