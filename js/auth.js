/* 學生登入／註冊／選角色（階段 9B-2：可選用 PIN；沒有 PIN 的舊流程維持原樣） */
        async function doStudentAuth(actionType) {
            const username = document.getElementById('student-username').value.trim(); if(!username) return alert("請輸入代碼！");
            if (Loading.busy) return;   /* 正在同步時不重複送出（Enter 或連點） */
            /* 後端支援 PIN 時，「註冊新帳號」改走有 PIN 的註冊畫面；後端沒升級或示範模式則維持原本流程 */
            /* 註冊前先確認後端狀態：PIN 功能正常→走有 PIN 的註冊；舊後端／尚未升級→沿用原流程；
               帳號保護設定壞掉或無法確認→不可偷偷改成「沒有 PIN 的註冊」，顯示說明即可 */
            if (actionType === 'register' && typeof StudentPin !== 'undefined') {
                let gate = StudentPin.registerGate();
                if (gate && typeof gate.then === 'function') { Loading.show(); try { gate = await gate; } finally { Loading.hide(); } }   /* 還要問後端時顯示救生圈；Loading.busy 同時擋住重複點擊 */
                if (!gate.ok) { alert(gate.message); return; }
                if (gate.mode === 'pin') { StudentPin.openRegister(username); return; }
            }
            const pinEl = document.getElementById('student-pin');
            const pinWrap = document.getElementById('student-pin-wrap');
            const pin = (actionType === 'login' && pinEl && pinWrap && !pinWrap.hidden) ? pinEl.value.trim() : '';
            const payload = { action: actionType, username: username };
            if (pin) payload.pin = pin;
            Loading.show(); let res;
            try { res = await apiCall(payload); }
            catch (e) { console.error(e); res = { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; }
            finally { Loading.hide(); if (pinEl) pinEl.value = ''; }   /* 成功、失敗、例外都會關閉救生圈；PIN 用完立刻清空 */
            if (res.status === 'error' && res.message) { alert(res.message); return; }
            if (res.status !== 'success' && res.status !== 'offline') { alert('登入失敗，請稍後再試'); return; }
            finishStudentLogin(res, username);
        }

        /* 登入／註冊／啟用成功後的共同收尾。opt.hold = true：先不進地圖（例如還要問要不要建立保護碼） */
        function finishStudentLogin(res, username, opt) {
            opt = opt || {};
            if (res.status === 'offline' || res.status === 'error') {
                /* 示範／離線模式：臨時編號（TMP_），畫面上會標示「示範模式」，不能使用班級、任務、獎勵功能 */
                currentUser = { user_id: generateTempId(), username: username, nickname: '', total_stars: 0, progress: {}, id_status: 'temporary' };
                AuthSession.student = null; StudentIdentity.set('temporary');
            } else {
                currentUser = res.user_data || {}; if (typeof currentUser.progress === 'string') { try { currentUser.progress = JSON.parse(currentUser.progress); } catch(e) { currentUser.progress = {}; } }
                AuthSession.student = (res.session && res.session.token) ? res.session : null;
                if (!currentUser.user_id) {
                    /* 後端沒有給學號：不偽造。仍可玩六座島（用帳號保存進度），但階段 9 的班級／任務／獎勵功能一律停用 */
                    currentUser.user_id = ''; currentUser.id_status = 'missing'; StudentIdentity.set('missing');
                    alert('這個帳號的資料不完整（缺少學號）。你還是可以玩，但請先告訴老師，請老師幫你檢查資料。');
                } else { currentUser.id_status = 'ok'; StudentIdentity.set('ok'); }
            }
            if (!currentUser.progress || typeof currentUser.progress !== 'object') currentUser.progress = {}; WP2.reset(); AdaptiveEngine.reset();
            const mustChange = (typeof StudentPin !== 'undefined') ? StudentPin.afterAuth(res) : false;
            if (mustChange) { StudentPin.forceChange(); return; }   /* 臨時 PIN：先更改才能玩 */
            if (!opt.hold) enterGame();
        }

        function enterGame() {
            if (!currentUser.progress.avatar) { CrewRegistry.open(); switchScreen('screen-avatar-select'); CrewRegistry.focusStart(); } else { EffectEngine.updateMap(); switchScreen('screen-map'); }
        }

        /* avatar 可以是新的船員代碼（例如 C3-2-1），也可以是舊帳號原本存的 emoji；兩種都照原樣存，不改寫 */
        function selectAvatar(emoji) {
            if(currentUser) {
                if(!currentUser.progress) currentUser.progress = {}; currentUser.progress.avatar = emoji;
                if(GAS_URL.includes("http")) apiCall({ action: 'submit_answer', username: currentUser.username, user_id: currentUser.user_id, update_progress: currentUser.progress });
            }
            EffectEngine.updateMap(); switchScreen('screen-map');
        }
