/**
 * Minimal CSV builder for dashboard exports.
 *
 * Emits UTF-8 with BOM so Excel opens Cyrillic correctly without manual
 * "import → encoding" steps. Quotes any field containing comma / quote /
 * newline per RFC 4180 and doubles internal quotes.
 */

const CSV_BOM = "﻿";

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  // RFC 4180: enclose in quotes if value contains comma, quote, or newline.
  // Internal quotes are escaped by doubling them.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from headers + rows. Rows are objects keyed by header.
 * Missing values become empty cells.
 */
export function buildCSV<T extends Record<string, unknown>>(
  headers: { key: keyof T; label: string }[],
  rows: T[]
): string {
  const headerLine = headers.map((h) => csvEscape(h.label)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => csvEscape(row[h.key])).join(",")
  );
  return CSV_BOM + [headerLine, ...dataLines].join("\r\n") + "\r\n";
}

/**
 * Format a Date for CSV — returns ISO date (YYYY-MM-DD) or full datetime,
 * depending on `withTime`. Excel and Google Sheets parse both formats
 * automatically as a date column.
 */
export function csvDate(d: Date | string | null | undefined, withTime = false): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  if (!withTime) return date.toISOString().slice(0, 10);
  // Google Sheets parses "YYYY-MM-DD HH:MM" reliably; ISO with T also works
  // but the slash-free space format is friendlier in Excel cells.
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/**
 * Build standard NextResponse-compatible headers for a CSV download.
 */
export function csvDownloadHeaders(filename: string): HeadersInit {
  // RFC 5987 filename* lets browsers handle non-ASCII filenames; we still
  // include filename= for older clients.
  const safe = filename.replace(/[^\w.-]/g, "_");
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  };
}
