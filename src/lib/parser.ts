// Parses uploaded XLSX/XLS/CSV files into { [module]: Row[] } using the same
// sheet-name -> module mapping and header row conventions as the original workbook.
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { MODULES, MODULE_URL_FIELDS, type ModuleName } from './types';

const SHEET_TO_MODULE: Record<string, ModuleName> = {
  'Company Intelligence': 'company_intelligence',
  'Pipeline Dashboard': 'pipeline_dashboard',
  'Clinical Intelligence': 'clinical_intelligence',
  'Technology Intelligence': 'technology_intelligence',
  'Target Landscape': 'target_landscape',
  'Clinical Trial Dashboard': 'clinical_trial_dashboard',
  'Catalyst Dashboard': 'catalyst_dashboard',
  'BD&L Intelligence': 'bdl_intelligence',
  'Funding & Investment': 'funding_investment',
  'Competitive Intelligence': 'competitive_intelligence',
  'Regulatory Dashboard': 'regulatory_dashboard',
};

// Reverse map for CSV: filename-based hint, e.g. "pipeline_dashboard.csv" or "Pipeline Dashboard.csv"
const NORMALIZED_MODULE_LOOKUP: Record<string, ModuleName> = {};
for (const mod of MODULES) NORMALIZED_MODULE_LOOKUP[mod] = mod;
for (const [sheet, mod] of Object.entries(SHEET_TO_MODULE)) {
  NORMALIZED_MODULE_LOOKUP[sheet.toLowerCase().replace(/[^a-z0-9]+/g, '_')] = mod;
}

export interface ParsedModuleData {
  [module: string]: Record<string, any>[];
}

function isSourcesFooter(v: any): boolean {
  return typeof v === 'string' && v.trim().startsWith('Sources:');
}

function excelSerialToISO(n: number): string | null {
  // Excel serial date (1900 date system) -> ISO yyyy-mm-dd
  if (typeof n !== 'number' || !isFinite(n)) return null;
  const utcDays = Math.floor(n - 25569);
  const utcMs = utcDays * 86400 * 1000;
  const d = new Date(utcMs);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function cleanCell(v: any): any {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  }
  return v;
}

// ------------------------------------------------------------------
// Header normalization — monthly source workbooks are hand-maintained and the
// source-URL column labels drift slightly between editions (e.g. the Oct 2026
// template switched "Company Announcement URL" -> "Company Announcement (URL)"
// and dropped the "Credible " prefix on several sheets' second URL column:
// "Credible Press Release URL" -> "Press Release (URL)"). If a row's key for
// these columns doesn't exactly match MODULE_URL_FIELDS, the app's diff engine,
// Manage Sources page, module tables, and AI Analyst all silently treat the
// source as absent — even though the uploaded data has a real URL. We fix this
// once here, at parse time, so every column ends up using the canonical field
// name the rest of the app already relies on, regardless of which edition of
// the template was uploaded.
function stripUrlParens(h: string): string {
  // "Foo (URL)" / "Foo( Url )" / "Foo  (url)" -> "Foo URL"
  return h
    .replace(/\s*\(\s*url\s*\)\s*$/i, ' URL')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCrediblePrefix(h: string): string {
  return h.replace(/^credible\s+/i, '').trim().toLowerCase();
}

/** Normalizes a header row's cell text for consistent matching, independent of module. */
function normalizeHeaderRow(headerRow: string[]): string[] {
  return headerRow.map((h) => (h ? stripUrlParens(h) : h));
}

/**
 * Re-maps normalized headers onto the exact canonical column names in
 * MODULE_URL_FIELDS for the given module, tolerating a missing/extra
 * "Credible " prefix on the secondary (independent) source column.
 */
function resolveUrlFieldAliases(module: ModuleName | null, headerRow: string[]): string[] {
  const urlFields = module ? MODULE_URL_FIELDS[module] : null;
  if (!urlFields) return headerRow;
  const [primField, indField] = urlFields;
  return headerRow.map((h) => {
    if (!h) return h;
    const lower = h.toLowerCase();
    if (lower === primField.toLowerCase()) return primField;
    if (lower === indField.toLowerCase()) return indField;
    // Tolerate the "Credible " prefix being present/absent/renamed on either side
    if (stripCredible(h) === stripCredible(indField)) return indField;
    if (stripCredible(h) === stripCredible(primField)) return primField;
    return h;
  });
  function stripCredible(s: string) {
    return stripCrediblePrefix(s);
  }
}

/** Parses one worksheet using the workbook convention: title(row1), subtitle(row2), blank(row3), headers(row4), data(row5+) */
function parseSheet(ws: XLSX.WorkSheet, module: ModuleName | null): Record<string, any>[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (rows.length < 4) return [];
  let headerRow = rows[3].map((h) => (h === null || h === undefined ? '' : String(h).trim()));
  headerRow = resolveUrlFieldAliases(module, normalizeHeaderRow(headerRow));
  const dataRows = rows.slice(4);
  const out: Record<string, any>[] = [];
  let section: string | null = null;
  for (const r of dataRows) {
    if (!r || r.every((v) => v === null || v === undefined || v === '')) continue;
    const c0 = r[0];
    if (isSourcesFooter(c0)) continue;
    // Section markers (Company Intelligence): all-caps label spanning row with rest empty
    if (typeof c0 === 'string' && /^[A-Z0-9 /\-]+$/.test(c0.trim()) && c0.trim().length > 8 && r.slice(1).every((v) => v === null || v === undefined)) {
      section = c0.trim();
      continue;
    }
    const obj: Record<string, any> = {};
    headerRow.forEach((h, i) => {
      if (!h) return;
      let val = r[i];
      val = cleanCell(val);
      obj[h] = val;
    });
    if (section) obj['Section'] = /PRECLINICAL/.test(section) ? 'Preclinical' : 'Clinical';
    if (Object.values(obj).some((v) => v !== null && v !== undefined && v !== '')) out.push(obj);
  }
  return out;
}

export function parseWorkbookBuffer(buf: ArrayBuffer): ParsedModuleData {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const result: ParsedModuleData = {};
  for (const sheetName of wb.SheetNames) {
    const mod = SHEET_TO_MODULE[sheetName.trim()];
    if (!mod) continue;
    const ws = wb.Sheets[sheetName];
    result[mod] = parseSheet(ws, mod);
  }
  return result;
}

export function parseCsvBuffer(text: string, moduleHint: ModuleName | null): ParsedModuleData {
  const parsed = Papa.parse(text.trim(), { header: false, skipEmptyLines: true });
  const rows = parsed.data as any[][];
  if (rows.length < 1) return {};
  // CSV convention: header row is the first row (simplified — no title/subtitle rows expected in a CSV export)
  const rawHeaderRow = rows[0].map((h) => (h === null || h === undefined ? '' : String(h).trim()));
  const mod = moduleHint || guessModuleFromHeaders(rawHeaderRow);
  if (!mod) return {};
  // Normalize source-URL column name drift (see parseSheet) before mapping cells to field names.
  const headerRow = resolveUrlFieldAliases(mod, normalizeHeaderRow(rawHeaderRow));
  const dataRows = rows.slice(1);
  const out: Record<string, any>[] = [];
  for (const r of dataRows) {
    if (!r || r.every((v) => v === null || v === undefined || v === '')) continue;
    if (isSourcesFooter(r[0])) continue;
    const obj: Record<string, any> = {};
    headerRow.forEach((h, i) => {
      if (!h) return;
      obj[h] = cleanCell(r[i]);
    });
    if (Object.values(obj).some((v) => v !== null && v !== undefined && v !== '')) out.push(obj);
  }
  return { [mod]: out };
}

function guessModuleFromHeaders(headers: string[]): ModuleName | null {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  if (set.has('company') && set.has('lead asset')) return 'company_intelligence';
  if (set.has('asset name') && set.has('target antigen')) return 'pipeline_dashboard';
  if (set.has('asset') && set.has('orr / response')) return 'clinical_intelligence';
  if (set.has('delivery class')) return 'technology_intelligence';
  if (set.has('target antigen') && set.has('# companies targeting (named)')) return 'target_landscape';
  if (set.has('trial / asset')) return 'clinical_trial_dashboard';
  if (set.has('catalyst type')) return 'catalyst_dashboard';
  if (set.has('acquirer / partner') && set.has('deal type')) return 'bdl_intelligence';
  if (set.has('round') && set.has('lead / notable investors')) return 'funding_investment';
  if (set.has('strategic camp')) return 'competitive_intelligence';
  if (set.has('agency') && set.has('event class')) return 'regulatory_dashboard';
  return null;
}

export function guessModuleFromFilename(filename: string): ModuleName | null {
  const norm = filename.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  for (const [key, mod] of Object.entries(NORMALIZED_MODULE_LOOKUP)) {
    if (norm.includes(key)) return mod;
  }
  return null;
}
