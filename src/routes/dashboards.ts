import { Hono } from 'hono';
import type { Bindings, AuthUser } from '../lib/types';
import { MODULES, type ModuleName } from '../lib/types';
import { requireAuth } from '../lib/middleware';
import { getLiveVersion, getRecordsForVersion, getAllRecordsGroupedByModule, getApprovedVersionForMonth, listAllMonths, getVersionById } from '../lib/data';
import { computeExecutiveKpis, computeTargetWhiteSpace } from '../lib/kpi';

export const dashboardRoutes = new Hono<{ Bindings: Bindings; Variables: { user: AuthUser } }>();

dashboardRoutes.use('*', requireAuth);

// Demo tier gets a restricted subset of columns/rows on some sensitive modules — still real, verified data.
const DEMO_ROW_LIMIT: Partial<Record<ModuleName, number>> = {
  company_intelligence: 8,
  bdl_intelligence: 5,
  funding_investment: 5,
};

// Demo tier has these sections fully locked: the nav entry stays visible/clickable,
// but no underlying data is ever returned — just a "restricted" placeholder flag.
const DEMO_HIDDEN_MODULES: ModuleName[] = [
  'pipeline_dashboard',
  'clinical_intelligence',
  'competitive_intelligence',
  'catalyst_dashboard',
];

const DEMO_RESTRICTED_MESSAGE = 'This section is not available on your Demo account. Upgrade to a full account to unlock live data.';

function applyDemoLimits(user: AuthUser, module: ModuleName, rows: any[]) {
  if (user.role !== 'demo') return rows;
  const limit = DEMO_ROW_LIMIT[module];
  return limit ? rows.slice(0, limit) : rows;
}

async function resolveVersion(c: any) {
  const db = c.env.DB;
  const user = c.get('user') as AuthUser;
  const monthParam = c.req.query('month');
  const versionParam = c.req.query('version_id');

  if (versionParam) {
    // Only Super Admin may request an arbitrary (possibly unapproved) version explicitly
    const v = await getVersionById(db, Number(versionParam));
    if (!v) return null;
    if (v.status !== 'approved' && user.role !== 'super_admin') return null;
    return v;
  }
  if (monthParam) {
    return await getApprovedVersionForMonth(db, monthParam);
  }
  return await getLiveVersion(db);
}

dashboardRoutes.get('/months', async (c) => {
  const user = c.get('user') as AuthUser;
  const months = await listAllMonths(c.env.DB, user.role === 'super_admin');
  const live = await getLiveVersion(c.env.DB);
  return c.json({ months, live_month: live?.month_label ?? null });
});

dashboardRoutes.get('/version-info', async (c) => {
  const v = await resolveVersion(c);
  if (!v) return c.json({ error: 'Version not found or not approved.' }, 404);
  return c.json({ version: v });
});

// ---------- Executive Dashboard ----------
dashboardRoutes.get('/executive', async (c) => {
  const v = await resolveVersion(c);
  if (!v) return c.json({ error: 'No approved data version available.' }, 404);
  const grouped = await getAllRecordsGroupedByModule(c.env.DB, v.id);
  const kpis = computeExecutiveKpis(grouped as any);
  const whiteSpace = computeTargetWhiteSpace(grouped as any);
  return c.json({ version: v, kpis, white_space: whiteSpace });
});

// ---------- Generic module fetch for the other 11 module dashboards ----------
dashboardRoutes.get('/module/:module', async (c) => {
  const module = c.req.param('module') as ModuleName;
  if (!MODULES.includes(module)) return c.json({ error: 'Unknown module.' }, 400);
  const user = c.get('user') as AuthUser;
  const v = await resolveVersion(c);
  if (!v) return c.json({ error: 'No approved data version available.' }, 404);

  if (user.role === 'demo' && DEMO_HIDDEN_MODULES.includes(module)) {
    return c.json({ version: v, module, count: 0, rows: [], restricted: true, message: DEMO_RESTRICTED_MESSAGE });
  }

  const records = await getRecordsForVersion(c.env.DB, v.id, module);
  const rows = applyDemoLimits(user, module, records.map((r) => ({ record_key: r.record_key, ...r.data })));
  return c.json({ version: v, module, count: rows.length, rows });
});

// ---------- Data Quality dashboard ----------
dashboardRoutes.get('/data-quality', async (c) => {
  const user = c.get('user') as AuthUser;
  const v = await resolveVersion(c);
  if (!v) return c.json({ error: 'No approved data version available.' }, 404);

  if (user.role === 'demo') {
    return c.json({
      version: v,
      restricted: true,
      message: DEMO_RESTRICTED_MESSAGE,
      totals: { totalRecords: 0, verified: 0, pendingSecondary: 0, unverified: 0, highConf: 0, medConf: 0, lowConf: 0 },
      by_module: {},
    });
  }

  const grouped = await getAllRecordsGroupedByModule(c.env.DB, v.id);

  let totalRecords = 0;
  let verified = 0, pendingSecondary = 0, unverified = 0;
  let highConf = 0, medConf = 0, lowConf = 0;
  const byModule: Record<string, any> = {};

  for (const [module, records] of Object.entries(grouped)) {
    let mVerified = 0, mPending = 0, mUnverified = 0;
    for (const r of records as any[]) {
      totalRecords++;
      const meta = r.data.__meta;
      if (meta.validation_status === 'Verified') { verified++; mVerified++; }
      else if (meta.validation_status === 'Pending Secondary Source') { pendingSecondary++; mPending++; }
      else { unverified++; mUnverified++; }

      if (meta.confidence_level === 'High') highConf++;
      else if (meta.confidence_level === 'Medium') medConf++;
      else lowConf++;
    }
    byModule[module] = { total: (records as any[]).length, verified: mVerified, pending_secondary: mPending, unverified: mUnverified };
  }

  return c.json({
    version: v,
    totals: { totalRecords, verified, pendingSecondary, unverified, highConf, medConf, lowConf },
    by_module: byModule,
  });
});

// ---------- Historical comparison: compare two approved months ----------
dashboardRoutes.get('/compare', async (c) => {
  const monthA = c.req.query('month_a');
  const monthB = c.req.query('month_b');
  if (!monthA || !monthB) return c.json({ error: 'month_a and month_b are required.' }, 400);
  const db = c.env.DB;
  const vA = await getApprovedVersionForMonth(db, monthA);
  const vB = await getApprovedVersionForMonth(db, monthB);
  if (!vA || !vB) return c.json({ error: 'One or both months have no approved version.' }, 404);

  const groupedA = await getAllRecordsGroupedByModule(db, vA.id);
  const groupedB = await getAllRecordsGroupedByModule(db, vB.id);
  const kpisA = computeExecutiveKpis(groupedA as any);
  const kpisB = computeExecutiveKpis(groupedB as any);

  const moduleCounts: Record<string, { a: number; b: number; delta: number }> = {};
  for (const mod of MODULES) {
    const a = (groupedA[mod] || []).length;
    const b = (groupedB[mod] || []).length;
    moduleCounts[mod] = { a, b, delta: b - a };
  }

  return c.json({ version_a: vA, version_b: vB, kpis_a: kpisA, kpis_b: kpisB, module_counts: moduleCounts });
});
