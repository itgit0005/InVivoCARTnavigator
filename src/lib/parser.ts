// Parses uploaded XLSX/XLS/CSV files into { [module]: Row[] } using the same
// sheet-name -> module mapping and header row conventions as the original workbook.
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { MODULES, type ModuleName } from './types';

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

/** Parses one worksheet using the workbook convention: title(row1), subtitle(row2), blank(row3), headers(row4), data(row5+) */
function parseSheet(ws: XLSX.WorkSheet): Record<string, any>[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (rows.length < 4) return [];
  const headerRow = rows[3].map((h) => (h === null || h === undefined ? '' : String(h).trim()));
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
    result[mod] = parseSheet(ws);
  }
  return result;
}

export function parseCsvBuffer(text: string, moduleHint: ModuleName | null): ParsedModuleData {
  const parsed = Papa.parse(text.trim(), { header: false, skipEmptyLines: true });
  const rows = parsed.data as any[][];
  if (rows.length < 1) return {};
  // CSV convention: header row is the first row (simplified — no title/subtitle rows expected in a CSV export)
  const headerRow = rows[0].map((h) => (h === null || h === undefined ? '' : String(h).trim()));
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
  const mod = moduleHint || guessModuleFromHeaders(headerRow);
  if (!mod) return {};
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
