import type { LiveRecord } from './kpi';
import { MODULES, type ModuleName } from './types';

export interface VersionRow {
  id: number;
  month_label: string;
  version_number: number;
  version_label: string | null;
  status: string;
  is_current_live: number;
  data_cutoff_date: string | null;
  reporting_month_confirmed: number;
  source_filename: string | null;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: number | null;
  uploaded_at: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  summary_json: string | null;
  baseline_version_id: number | null;
}

export async function getLiveVersion(db: D1Database): Promise<VersionRow | null> {
  const row = await db.prepare('SELECT * FROM data_versions WHERE is_current_live = 1 LIMIT 1').first();
  return (row as unknown as VersionRow) || null;
}

export async function getVersionById(db: D1Database, id: number): Promise<VersionRow | null> {
  const row = await db.prepare('SELECT * FROM data_versions WHERE id = ?').bind(id).first();
  return (row as unknown as VersionRow) || null;
}

export async function getRecordsForVersion(
  db: D1Database,
  versionId: number,
  module?: ModuleName
): Promise<LiveRecord[]> {
  let query = 'SELECT module, record_key, data_json, confidence_level, validation_status, primary_source_url, independent_source_url, source_date, verification_date, conflict_notes, change_type FROM records WHERE version_id = ?';
  const params: any[] = [versionId];
  if (module) {
    query += ' AND module = ?';
    params.push(module);
  }
  query += ' ORDER BY row_order ASC, id ASC';
  const { results } = await db.prepare(query).bind(...params).all();
  return (results || []).map((r: any) => ({
    module: r.module,
    record_key: r.record_key,
    data: {
      ...JSON.parse(r.data_json),
      __meta: {
        confidence_level: r.confidence_level,
        validation_status: r.validation_status,
        primary_source_url: r.primary_source_url,
        independent_source_url: r.independent_source_url,
        source_date: r.source_date,
        verification_date: r.verification_date,
        conflict_notes: r.conflict_notes,
        change_type: r.change_type,
      },
    },
  }));
}

export async function getAllRecordsGroupedByModule(
  db: D1Database,
  versionId: number
): Promise<Record<string, LiveRecord[]>> {
  const all = await getRecordsForVersion(db, versionId);
  const grouped: Record<string, LiveRecord[]> = {};
  for (const mod of MODULES) grouped[mod] = [];
  for (const r of all) {
    if (!grouped[r.module]) grouped[r.module] = [];
    grouped[r.module].push(r);
  }
  return grouped;
}

export async function listApprovedVersionsForMonth(db: D1Database, monthLabel: string) {
  const { results } = await db
    .prepare('SELECT * FROM data_versions WHERE month_label = ? ORDER BY version_number ASC')
    .bind(monthLabel)
    .all();
  return results as unknown as VersionRow[];
}

export async function listAllMonths(db: D1Database, includeUnapproved: boolean) {
  const query = includeUnapproved
    ? 'SELECT DISTINCT month_label FROM data_versions ORDER BY month_label DESC'
    : `SELECT DISTINCT month_label FROM data_versions WHERE status = 'approved' ORDER BY month_label DESC`;
  const { results } = await db.prepare(query).all();
  return (results || []).map((r: any) => r.month_label);
}

export async function getApprovedVersionForMonth(db: D1Database, monthLabel: string): Promise<VersionRow | null> {
  const row = await db
    .prepare(`SELECT * FROM data_versions WHERE month_label = ? AND status = 'approved' ORDER BY version_number DESC LIMIT 1`)
    .bind(monthLabel)
    .first();
  return (row as unknown as VersionRow) || null;
}
