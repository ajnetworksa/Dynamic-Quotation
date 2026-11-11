// Small helper for "Export" on the Customer / Product pages: one sheet, bold header, Excel-friendly (Arabic text is kept).
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function exportToXlsx(fileBase: string, sheetName: string, columns: { header: string; width?: number }[], rows: (string | number | null | undefined)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c, i) => ({ header: c.header, key: String(i), width: c.width ?? 20 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const r of rows) ws.addRow(r.map(v => (v === null || v === undefined ? '' : v)));
  const buf = await wb.xlsx.writeBuffer();
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase}_${stamp}.xlsx`);
}
