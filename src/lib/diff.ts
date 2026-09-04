import { MODULE_KEY_FIELDS, MODULES, type ModuleName } from './types';
import type { ParsedModuleData } from './parser';

export interface DiffEntry {
  module: ModuleName;
  record_key: string;
  change_type: 'new' | 'updated' | 'unchanged' | 'discontinued' | 'conflicting';
  previous?: Record<string, any> | null;
  next?: Record<string, any> | null;
  field_diffs?: { field: string; before: any; after: any }[];
}

export interface DiffSummary {
  [module: string]: { new: number; updated: number; discontinued: number; conflicting: number; unchanged: number };
}

export function buildRecordKey(module: ModuleName, row: Record<string, any>): string {
  const fields = MODULE_KEY_FIELDS[module];
  return fields.map((f) => String(row[f] ?? '').trim()).join('|');
}

function normalizeValue(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function computeFieldDiffs(before: Record<string, any>, after: Record<string, any>) {
  const diffs: { field: string; before: any; after: any }[] = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (k === 'Section') continue; // internal bookkeeping field, not a meaningful content change on its own
    const b = normalizeValue(before?.[k]);
    const a = normalizeValue(after?.[k]);
    if (b !== a) diffs.push({ field: k, before: before?.[k] ?? null, after: after?.[k] ?? null });
  }
  return diffs;
}

/**
 * Compares newly uploaded module data against the current live baseline records.
 * baseline: map of module -> array of { record_key, data } from the live version.
 */
export function diffAgainstBaseline(
  uploaded: ParsedModuleData,
  baseline: Record<ModuleName, { record_key: string; data: Record<string, any> }[]>
): { entries: DiffEntry[]; summary: DiffSummary } {
  const entries: DiffEntry[] = [];
  const summary: DiffSummary = {};

  const modulesTouched = new Set<ModuleName>([
    ...(Object.keys(uploaded) as ModuleName[]),
    ...(Object.keys(baseline) as ModuleName[]),
  ]);

  for (const module of modulesTouched) {
    if (!MODULES.includes(module)) continue;
    summary[module] = { new: 0, updated: 0, discontinued: 0, conflicting: 0, unchanged: 0 };

    const baseRows = baseline[module] || [];
    const baseMap = new Map(baseRows.map((r) => [r.record_key, r.data]));

    const newRows = uploaded[module] || [];
    const newKeys = new Set<string>();

    for (const row of newRows) {
      const key = buildRecordKey(module, row);
      if (!key || key.replace(/\|/g, '').trim() === '') continue;
      newKeys.add(key);
      const prev = baseMap.get(key);
      if (!prev) {
        entries.push({ module, record_key: key, change_type: 'new', previous: null, next: row });
        summary[module].new++;
      } else {
        const diffs = computeFieldDiffs(prev, row);
        if (diffs.length === 0) {
          entries.push({ module, record_key: key, change_type: 'unchanged', previous: prev, next: row });
          summary[module].unchanged++;
        } else {
          entries.push({ module, record_key: key, change_type: 'updated', previous: prev, next: row, field_diffs: diffs });
          summary[module].updated++;
        }
      }
    }

    // Anything present in baseline but missing from upload => discontinued
    for (const [key, prevData] of baseMap.entries()) {
      if (!newKeys.has(key)) {
        entries.push({ module, record_key: key, change_type: 'discontinued', previous: prevData, next: null });
        summary[module].discontinued++;
      }
    }
  }

  return { entries, summary };
}
