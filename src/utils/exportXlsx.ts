import { sanitizeSpreadsheetRow } from './spreadsheet';

/**
 * Writes rows to an .xlsx download. The spreadsheet library is loaded on
 * demand (it is large and only needed when someone actually exports), and
 * every text cell is neutralised against formula injection first.
 */
export async function exportRowsToXlsx(
  rows: Record<string, unknown>[],
  options: { sheetName: string; fileName: string; columnWidths?: number[] }
): Promise<void> {
  const XLSX = await import('xlsx');
  const safeRows = rows.map((r) => sanitizeSpreadsheetRow(r));
  const worksheet = XLSX.utils.json_to_sheet(safeRows);
  if (options.columnWidths) {
    worksheet['!cols'] = options.columnWidths.map((wch) => ({ wch }));
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName);
  XLSX.writeFile(workbook, options.fileName);
}

/** Copies text to the clipboard, with a fallback for non-secure contexts. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
