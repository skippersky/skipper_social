/**
 * CSV export for marketing send history (Sprint 11).
 *
 * Excel opens these files by double-click, so the output follows RFC 4180 with
 * CRLF line endings and a UTF-8 BOM. Quoting is applied only where a value
 * needs it, which keeps repeated exports diffable.
 */

/** Characters that force a value to be quoted. */
const NEEDS_QUOTE = /[",\r\n]/;

/** Excel needs the BOM to detect UTF-8; without it Swahili text turns to mojibake. */
export const CSV_BOM = '\uFEFF';

export type CsvCell = string | number | boolean | null | undefined;

/** Quotes a single value, doubling any embedded quote. */
export function escapeCsvValue(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!NEEDS_QUOTE.test(text)) return text;
  return '"' + text.replace(/"/g, '""') + '"';
}

/**
 * Builds a document from a header row plus data rows. Short rows are padded so
 * a missing field can never shift the remaining columns.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    const cells: CsvCell[] = [];
    for (let i = 0; i < headers.length; i += 1) cells.push(row[i]);
    lines.push(cells.map(escapeCsvValue).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

function pad(value: number): string {
  return value < 10 ? '0' + value : String(value);
}

/** Local calendar day, so the filename matches what the user sees on screen. */
export function isoDay(now: number): string {
  const date = new Date(now);
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

export function buildCsvFilename(prefix: string, now: number): string {
  const safe = prefix.replace(/[^A-Za-z0-9_-]/g, '') || 'export';
  return safe + '-' + isoDay(now) + '.csv';
}

export interface CsvDownloadEnv {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  document?: Document | null;
}

/**
 * Triggers a browser download. Returns false instead of throwing when the host
 * cannot create object URLs (jsdom, private mode), so the calling view shows a
 * toast rather than breaking.
 */
export function downloadCsv(filename: string, csvText: string, env?: CsvDownloadEnv): boolean {
  const scope = env ?? {};
  const globalUrl = typeof URL !== 'undefined' ? URL : undefined;
  const create = scope.createObjectURL ?? globalUrl?.createObjectURL?.bind(globalUrl);
  const revoke = scope.revokeObjectURL ?? globalUrl?.revokeObjectURL?.bind(globalUrl);
  const doc = scope.document ?? (typeof document !== 'undefined' ? document : null);
  if (typeof Blob === 'undefined' || !create || !doc) return false;
  let url = '';
  try {
    const blob = new Blob([CSV_BOM + csvText], { type: 'text/csv;charset=utf-8;' });
    url = create(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    doc.body?.appendChild(link);
    link.click();
    doc.body?.removeChild(link);
    return true;
  } catch {
    return false;
  } finally {
    if (url && revoke) {
      try {
        revoke(url);
      } catch {
        /* nothing useful to do */
      }
    }
  }
}
