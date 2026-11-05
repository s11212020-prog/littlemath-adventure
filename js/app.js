/* 共用工具、API 呼叫、畫面切換、登出 */
        const ISLAND_ALIASES = {
            "加法島":"加法島", "減法島":"減法島", "乘法島":"乘法島", "除法島":"除法島",
            "應用題島":"應用題島", "四則運算島":"四則運算島",
            "addition":"加法島", "subtraction":"減法島", "multiplication":"乘法島", "division":"除法島",
            "wordProblems":"應用題島", "mixedOperations":"四則運算島"
        };
        const SESSION_ID = 'SES_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000);
        function genLogId() { return 'LOG_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000000); }

        let currentUser = null; let selectedIslandForModal = ""; let globalUsers = []; let globalLogs = [];
        const delay = ms => new Promise(res => setTimeout(res, ms));

        function escapeHTML(str) { if(str == null) return ''; return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); }
        function generateUUID() { return 'USR_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000); }
        /* 示範／離線模式的臨時編號：前綴 TMP_，和後端核發的正式學號（USR_）一眼可分，也絕不會被當成正式學號送出 */
        function generateTempId() { return 'TMP_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000); }
        
        /* 學生登入後會自動附上 token 的動作（9B-2 起不只作答） */
        const STUDENT_TOKEN_ACTIONS = ['submit_answer', 'change_pin', 'create_recovery_code', 'regenerate_recovery_code', 'get_upgrade_info', 'get_profile', 'update_student_profile', 'get_my_history', 'preview_class_by_code', 'join_class', 'leave_class', 'confirm_class_share', 'request_class_transfer', 'cancel_class_transfer', 'get_student_class', 'list_student_assignments', 'get_student_inventory', 'claim_reward', 'redeem_voucher', 'save_equipped_items', 'list_student_quizzes', 'quiz_start', 'quiz_save_draft', 'quiz_submit', 'quiz_result'];
        const NO_RETRY_ACTIONS = ['register', 'activate_pin', 'change_pin', 'create_recovery_code', 'regenerate_recovery_code', 'reset_pin_with_recovery_code', 'update_student_profile', 'join_class', 'leave_class', 'confirm_class_share', 'request_class_transfer', 'cancel_class_transfer', 'create_class', 'archive_class', 'restore_class', 'regenerate_class_code', 'decide_transfer_request', 'remove_class_student', 'update_student_real_name', 'approve_pending_identity', 'issue_activation_code', 'revoke_activation_code', 'reset_student_pin', 'create_assignment', 'update_assignment', 'close_assignment'];
        /* 階段 9F-3a：後端回「系統維護中」（SERVICE_MAINTENANCE）時，一律改用這句固定的白話訊息，並顯示提醒條。
           不顯示後端傳來的任何文字，也不顯示表格名稱、欄位或安全資訊；登入／註冊畫面本來就會跳出訊息，所以那兩個不再重複顯示提醒條。 */
        const MAINT_TEXT = '系統暫時維護中，暫時不能登入或作答。請稍後再試，或告訴老師。';
        function showMaintenanceNotice() {
            try {
                let b = document.getElementById('maint-notice');
                if (!b) {
                    b = document.createElement('div'); b.id = 'maint-notice'; b.setAttribute('role', 'alert');
                    b.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:100000;background:#fff4d6;color:#4a3000;border:2px solid #b07a00;border-radius:14px;padding:12px 14px;font-size:18px;line-height:1.5;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;justify-content:space-between';
                    const t = document.createElement('span'); t.id = 'maint-notice-text'; t.textContent = MAINT_TEXT;
                    const x = document.createElement('button'); x.type = 'button'; x.id = 'maint-notice-close'; x.textContent = '知道了';
                    x.style.cssText = 'min-width:44px;min-height:44px;padding:8px 14px;font-size:16px;border-radius:10px;border:2px solid #b07a00;background:#fff;color:#4a3000;cursor:pointer';
                    x.addEventListener('click', function () { b.hidden = true; });
                    b.appendChild(t); b.appendChild(x); document.body.appendChild(b);
                }
                b.hidden = false;
            } catch (e) { /* 提醒條失敗不影響其他流程 */ }
        }
        /* 使用者看得到的用詞：後端訊息裡的「PIN」一律顯示成「密碼」、「保護碼」顯示成「密碼重設碼」、學生帳號的「代碼」顯示成「帳號」（tourfix2.1）。
           只換顯示用的文字欄位（message／note／compat_notice）；後端、API 動作與欄位名稱、錯誤代碼（例如 MUST_CHANGE_PIN）都不變。 */
        function userWords(t) {
            return String(t == null ? '' : t).replace(/代碼或[ \t]*PIN[ \t]*/g, '帳號或密碼').split('代碼或').join('帳號或').split('找不到這個代碼喔！請點擊「註冊新帳號」。').join('找不到這個帳號喔！請點擊「建立帳號」。').split('此代碼已經被使用囉').join('這個帳號已經被使用囉').split('代碼太長了').join('帳號太長了').split('代碼不能以').join('帳號不能以').split('你的代碼裡').join('你的帳號裡').split('保護碼').join('密碼重設碼').replace(/(?<![A-Za-z_])[ \t]*PIN[ \t]*(?![A-Za-z_])/g, '密碼');
        }
        function userWordsData(data) {
            if (data && typeof data === 'object') ['message', 'note', 'compat_notice'].forEach(function (k) { if (typeof data[k] === 'string') data[k] = userWords(data[k]); });
            return data;
        }
        async function apiCall(payload) {
            if(!GAS_URL || !GAS_URL.startsWith("http")) return { status: 'offline' };
            /* 階段 9B-1：學生登入後若拿到 token，作答時自動附上（後端旗標關閉時會被忽略） */
            if (STUDENT_TOKEN_ACTIONS.indexOf(payload.action) >= 0 && !payload.token && typeof AuthSession !== 'undefined' && AuthSession.student && AuthSession.student.token) payload = Object.assign({}, payload, { token: AuthSession.student.token });
            /* 會改變憑證或只顯示一次結果的動作，絕不自動重送（重送可能讓第一次的結果遺失，或重複核發） */
            const canRetry = NO_RETRY_ACTIONS.indexOf(payload.action) < 0;
            for (let t = 0; t < 2; t++) {
                try {
                    const r = await fetch(GAS_URL, { method: 'POST', cache: 'no-store', body: JSON.stringify(payload) }); let data = await r.json();
                    if (data && data.status === 'error' && data.code === 'SERVICE_MAINTENANCE') { data = { status: 'error', code: 'SERVICE_MAINTENANCE', message: MAINT_TEXT }; if (payload.action !== 'login' && payload.action !== 'register') showMaintenanceNotice(); return data; }
                    if (data && data.code === 'SESSION_INVALID' && payload.action === 'submit_answer' && typeof SessionGuard !== 'undefined') SessionGuard.studentExpired();
                    if (data && data.code === 'MUST_CHANGE_PIN' && payload.action === 'submit_answer' && typeof StudentPin !== 'undefined') StudentPin.forceChange();
                    return userWordsData(data);
                }
                catch(e) { if (t === 1 || !canRetry) return { status: 'error', message: '連線失敗，請檢查網路後再試一次' }; await delay(800); }
            }
        }

        /* 全畫面「資料同步中」（階段 8.1：救生圈動畫）。只管顯示／隱藏，不碰 API 內容。
           show() 之後一定要 hide()：呼叫端用 try／finally，成功、失敗、例外都會收尾。busy 用來擋住重複送出。 */
        const Loading = {
            busy: false,
            show: function() { this.busy = true; const e = document.getElementById('loading'); if (e) { e.style.display = 'flex'; e.setAttribute('aria-busy', 'true'); } },
            hide: function() { this.busy = false; const e = document.getElementById('loading'); if (e) { e.style.display = 'none'; e.setAttribute('aria-busy', 'false'); } }
        };

        // 綁定首頁身分按鈕
        document.addEventListener("DOMContentLoaded", () => {
            const studentBtn = document.getElementById("btn-role-student");
            const teacherBtn = document.getElementById("btn-role-teacher");
            if(studentBtn) studentBtn.addEventListener("click", () => switchScreen("screen-student-login"));
            if(teacherBtn) teacherBtn.addEventListener("click", () => switchScreen("screen-teacher-login"));   /* 我是老師：直接進教師登入，不經過管理員頁面 */
            const adminBtn = document.getElementById("btn-role-admin");
            if(adminBtn) adminBtn.addEventListener("click", () => switchScreen("screen-admin-login"));   /* 管理員只從首頁右上角的小按鈕進入 */
        });

        function switchScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); if (id === 'screen-map' && typeof SeaMap !== 'undefined') SeaMap.onShow(); if (typeof Tutorial !== 'undefined') Tutorial.onScreen(id); }
        function logoutToRoleSelect() { if (typeof Tutorial !== 'undefined') Tutorial.abort(); if (typeof TitleRoute !== 'undefined') TitleRoute.close(); Loading.hide(); WP2.reset(); AnimationEngine.stopAll(); QF.state = 'IDLE'; QuestionKeys.detach(); LighthouseSystem.skip(); if (typeof AuthSession !== 'undefined') AuthSession.clearAll(); if (typeof StudentIdentity !== 'undefined') StudentIdentity.set('none'); if (typeof StudentPin !== 'undefined') StudentPin.reset(); if (typeof TeacherPortal !== 'undefined') TeacherPortal.reset(); if (typeof StudentClass !== 'undefined') StudentClass.reset(); if (typeof TeacherClass !== 'undefined') TeacherClass.reset(); if (typeof TaskRun !== 'undefined') TaskRun.reset(); if (typeof StudentTasks !== 'undefined') StudentTasks.reset(); if (typeof TeacherTasks !== 'undefined') TeacherTasks.reset(); if (typeof AdminCenter !== 'undefined') AdminCenter.reset(); if (typeof TeacherQuiz !== 'undefined') TeacherQuiz.reset(); if (typeof StudentQuiz !== 'undefined') StudentQuiz.reset(); globalUsers = []; globalLogs = []; currentUser = null; selectedIslandForModal = ""; document.getElementById('student-username').value = ""; document.getElementById('admin-pwd').value = ""; switchScreen('screen-role-select'); }
