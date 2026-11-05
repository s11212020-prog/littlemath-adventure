/* 階段 10：共用 CSV 匯出（UTF-8 BOM，欄位一律加雙引號，附範圍／時間／教師／班級說明列）。
   * 以 = + - @ Tab Enter 開頭的文字前面補單引號，避免被試算表當成公式；純數字（含負數）不補。
   * 這個動作是「冪等」的：後端已補過單引號的內容不會再補第二次。
   * 不會修改資料、不會寫入任何儲存空間；檔案只在使用者按下匯出時由瀏覽器下載。 */
const CsvExport = (function () {
    const META_LABEL = { scope: '匯出範圍', exported_at: '匯出時間', teacher: '教師', class_name: '班級', student: '學生', total: '符合筆數', note: '說明', quiz: '測驗', mode: '模式', assignment: '指派' };
    const NUM = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;
    function safe(v) {
        if (v === undefined || v === null) return '';
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        const s = String(v);
        if (s === '') return '';
        if (/^[=+\-@\t\r]/.test(s) && !NUM.test(s)) return "'" + s;
        return s;
    }
    function quote(v) { return '"' + safe(v).replace(/"/g, '""') + '"'; }
    function build(meta, columns, rows) {
        const out = [];
        Object.keys(meta || {}).forEach(function (k) { out.push([quote(META_LABEL[k] || k), quote(meta[k])].join(',')); });
        if (out.length) out.push('');
        out.push(columns.map(quote).join(','));
        rows.forEach(function (r) { out.push(r.map(quote).join(',')); });
        return '\uFEFF' + out.join('\r\n') + '\r\n';
    }
    function download(filename, text) {
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
    }
    function stamp() { const d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }
    function fname(base) { return (String(base).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'export') + '-' + stamp() + '.csv'; }   /* 檔名只用英數字（各系統與瀏覽器都不會出錯）；中文說明在檔案的說明列 */
    /* 分批取得：fetchPart(offset) 回傳 {status, meta, columns, rows, next_offset}；最多 400 批 */
    async function fetchAll(fetchPart, onProgress) {
        let off = 0, meta = null, columns = null, rows = [];
        for (let i = 0; i < 400; i++) {
            const r = await fetchPart(off);
            if (!r || r.status !== 'success') return r || { status: 'error', message: '匯出失敗' };
            if (!meta) { meta = r.meta; columns = r.columns; }
            rows = rows.concat(r.rows || []);
            if (onProgress) onProgress(rows.length, r.total);
            if (r.next_offset === null || r.next_offset === undefined) break;
            off = r.next_offset;
        }
        return { status: 'success', meta: meta || {}, columns: columns || [], rows: rows };
    }
    return { safe: safe, build: build, download: download, fname: fname, fetchAll: fetchAll };
})();
