import { Hono } from 'hono';
import type { Bindings, AuthUser, ModuleName } from '../lib/types';
import { MODULES } from '../lib/types';
import { requireAuth } from '../lib/middleware';
import { getLiveVersion, getRecordsForVersion, getApprovedVersionForMonth } from '../lib/data';
import { canExport } from '../lib/auth';

export const exportRoutes = new Hono<{ Bindings: Bindings; Variables: { user: AuthUser } }>();

exportRoutes.use('*', requireAuth);

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((h) => h !== '__meta');
  const escapeCell = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => escapeCell(r[h])).join(','));
  return lines.join('\n');
}

exportRoutes.get('/:moduleParam', async (c) => {
  const user = c.get('user') as AuthUser;
  if (!canExport(user)) return c.json({ error: 'Export is not available for your account.' }, 403);

  const rawParam = c.req.param('moduleParam') || '';
  const module = rawParam.replace(/\.csv$/i, '') as ModuleName;
  if (!MODULES.includes(module)) return c.json({ error: 'Unknown module.' }, 400);

  const monthParam = c.req.query('month');
  const version = monthParam ? await getApprovedVersionForMonth(c.env.DB, monthParam) : await getLiveVersion(c.env.DB);
  if (!version) return c.json({ error: 'No approved data available.' }, 404);

  const records = await getRecordsForVersion(c.env.DB, version.id, module);
  const rows = records.map((r) => { const { __meta, ...rest } = r.data; return rest; });
  const csv = toCsv(rows);

  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${module}_${version.month_label}.csv"`);
  return c.body(csv);
});
