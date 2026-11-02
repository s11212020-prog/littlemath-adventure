本機字型說明（離線可用，不依賴 Google Fonts）
==========================================

字型家族：Noto Sans TC（網頁中以 font-family: "Noto Sans TC" 使用）
來源：Noto Sans CJK TC（Regular / Bold / Black），授權 SIL Open Font License 1.1（見 OFL.txt）
作法：以 fontTools 子集化，輸出 WOFF2，分成「基本片」＋ 12 片常用字（Big5 第一級字）依 unicode-range 載入。
  - 基本片：英數、標點、注音、本網站實際用到的所有字（每個字重約 0.35 MB）
  - s01~s12：其餘常用字；頁面上沒出現的字，瀏覽器不會下載對應檔案
字重對應：Regular→400/500、Bold→700、Black→800/900
宣告檔：../css/fonts.css（font-display: swap；載入前先用系統中文字型，不會空白）

之後新增了網站文字，請重新執行 work/fontbuild/build_fonts.py 重新產生基本片。
若遇到 Big5 第一級以外的罕用字，會自動使用系統字型補上（PingFang TC、微軟正黑體等）。
