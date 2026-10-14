import { Hono } from 'hono';
import type { Bindings, AuthUser, ModuleName } from '../lib/types';
import { MODULES } from '../lib/types';
import { requireAuth, requireSuperAdmin } from '../lib/middleware';
import { parseWorkbookBuffer, parseCsvBuffer, guessModuleFromFilename } from '../lib/parser';
import { diffAgainstBaseline, buildRecordKey, deriveRecordSourceMeta } from '../lib/diff';
import { getLiveVersion, getAllRecordsGroupedByModule, getVersionById, listApprovedVersionsForMonth } from '../lib/data';
import { hashPassword, logAudit } from '../lib/auth';

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: { user: AuthUser } }>();

adminRoutes.use('*', requireAuth);
adminRoutes.use('*', requireSuperAdmin);

// ============================================================
// UPLOAD — stage a new monthly file or a same-month revision
// ============================================================
adminRoutes.post('/upload', async (c) => {
  const db = c.env.DB;
  const user = c.get('user') as AuthUser;

  const form = await c.req.formData();
  const file = form.get('file') as File | null;
  const monthLabel = String(form.get('month_label') || '').trim(); // e.g. "2026-10"
  const cutoffDate = String(form.get('data_cutoff_date') || '').trim() || null;
  const versionLabelInput = String(form.get('version_label') || '').trim();

  if (!file) return c.json({ error: 'A file is required.' }, 400);
  if (!/^\d{4}-\d{2}$/.test(monthLabel)) return c.json({ error: 'month_label must be in YYYY-MM format.' }, 400);

  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase();
  let parsedData: Record<string, any[]>;

  try {
    if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsb') {
      const buf = await file.arrayBuffer();
      parsedData = parseWorkbookBuffer(buf);
    } else if (ext === 'csv') {
      const text = await file.text();
      const hint = guessModuleFromFilename(filename);
      parsedData = parseCsvBuffer(text, hint);
    } else {
      return c.json({ error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv.' }, 400);
    }
  } catch (e: any) {
    return c.json({ error: `Failed to parse file: ${e.message || e}` }, 400);
  }

  const totalParsedRows = Object.values(parsedData).reduce((s, r) => s + r.length, 0);
  if (totalParsedRows === 0) {
    return c.json({ error: 'No recognizable rows were found in the uploaded file. Check that sheet names / column headers match the platform module structure.' }, 400);
  }

  // Determine next version number for this month
  const existingVersions = await listApprovedVersionsForMonth(db, monthLabel);
  const nextVersionNumber = existingVersions.length > 0 ? Math.max(...existingVersions.map((v) => v.version_number)) + 1 : 1;

  // Baseline to diff against: current live version (any month) — this is what "compare with the previous approved version" means
  const baseline = await getLiveVersion(db);
  const baselineGrouped: Record<string, any[]> = {};
  if (baseline) {
    const grouped = await getAllRecordsGroupedByModule(db, baseline.id);
    for (const mod of MODULES) {
      baselineGrouped[mod] = (grouped[mod] || []).map((r) => ({ record_key: r.record_key, data: r.data }));
    }
  } else {
    for (const mod of MODULES) baselineGrouped[mod] = [];
  }

  const { entries, summary } = diffAgainstBaseline(parsedData as any, baselineGrouped as any);

  const versionLabel = versionLabelInput || (nextVersionNumber === 1 ? 'Version 1' : `Version ${nextVersionNumber} (Revised)`);

  const insertVersion = await db
    .prepare(
      `INSERT INTO data_versions
        (month_label, version_number, version_label, status, is_current_live, data_cutoff_date, reporting_month_confirmed, source_filename, file_type, file_size, uploaded_by, review_notes, summary_json, baseline_version_id)
       VALUES (?, ?, ?, 'pending_review', 0, ?, 0, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .bind(
      monthLabel,
      nextVersionNumber,
      versionLabel,
      cutoffDate,
      filename,
      ext,
      file.size,
      user.id,
      JSON.stringify(summary),
      baseline?.id ?? null
    )
    .run();

  const versionId = insertVersion.meta.last_row_id as number;

  // Persist staged records (all rows from the upload, regardless of change type, so Super Admin can review the full picture)
  let rowOrderCounters: Record<string, number> = {};
  const stmts: D1PreparedStatement[] = [];

  for (const mod of Object.keys(parsedData) as ModuleName[]) {
    rowOrderCounters[mod] = 0;
    for (const row of parsedData[mod]) {
      const key = buildRecordKey(mod, row);
      if (!key || key.replace(/\|/g, '').trim() === '') continue;
      const entry = entries.find((e) => e.module === mod && e.record_key === key && e.next === row);
      const changeType = entry?.change_type || 'new';
      const meta = deriveRecordSourceMeta(mod, row);
      stmts.push(
        db
          .prepare(
            `INSERT INTO records (version_id, module, record_key, data_json, row_order, change_type, confidence_level, validation_status, primary_source_url, independent_source_url, source_date, verification_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            versionId,
            mod,
            key,
            JSON.stringify(row),
            rowOrderCounters[mod]++,
            changeType,
            meta.confidence_level,
            meta.validation_status,
            meta.primary_source_url,
            meta.independent_source_url,
            meta.source_date,
            cutoffDate
          )
      );
    }
  }

  // Change log entries (for the review UI + audit trail)
  for (const entry of entries) {
    if (entry.change_type === 'unchanged') continue; // only log actionable changes
    stmts.push(
      db
        .prepare(
          `INSERT INTO change_log (version_id, module, record_key, change_type, previous_data_json, new_data_json, field_diffs_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          versionId,
          entry.module,
          entry.record_key,
          entry.change_type,
          entry.previous ? JSON.stringify(entry.previous) : null,
          entry.next ? JSON.stringify(entry.next) : null,
          entry.field_diffs ? JSON.stringify(entry.field_diffs) : null
        )
    );
  }

  if (stmts.length > 0) await db.batch(stmts);

  await logAudit(db, user, 'UPLOAD_STAGED', 'data_version', String(versionId), {
    month_label: monthLabel,
    version_number: nextVersionNumber,
    filename,
    summary,
  });

  return c.json({
    version_id: versionId,
    month_label: monthLabel,
    version_number: nextVersionNumber,
    version_label: versionLabel,
    status: 'pending_review',
    summary,
    total_changes: entries.filter((e) => e.change_type !== 'unchanged').length,
  });
});

// ============================================================
// REVIEW — fetch the full diff / change list for a pending version
// ============================================================
adminRoutes.get('/versions/:id/review', async (c) => {
  const db = c.env.DB;
  const versionId = Number(c.req.param('id'));
  const version = await getVersionById(db, versionId);
  if (!version) return c.json({ error: 'Version not found.' }, 404);

  const moduleFilter = c.req.query('module');
  const changeTypeFilter = c.req.query('change_type');

  let query = 'SELECT * FROM change_log WHERE version_id = ?';
  const params: any[] = [versionId];
  if (moduleFilter) { query += ' AND module = ?'; params.push(moduleFilter); }
  if (changeTypeFilter) { query += ' AND change_type = ?'; params.push(changeTypeFilter); }
  query += ' ORDER BY module, record_key';

  const { results } = await db.prepare(query).bind(...params).all();
  const changes = (results || []).map((r: any) => ({
    ...r,
    previous_data: r.previous_data_json ? JSON.parse(r.previous_data_json) : null,
    new_data: r.new_data_json ? JSON.parse(r.new_data_json) : null,
    field_diffs: r.field_diffs_json ? JSON.parse(r.field_diffs_json) : null,
  }));

  return c.json({
    version,
    summary: version.summary_json ? JSON.parse(version.summary_json) : {},
    changes,
  });
});

// ============================================================
// APPROVE — make a version the live/current dataset
// ============================================================
adminRoutes.post('/versions/:id/approve', async (c) => {
  const db = c.env.DB;
  const user = c.get('user') as AuthUser;
  const versionId = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const version = await getVersionById(db, versionId);
  if (!version) return c.json({ error: 'Version not found.' }, 404);
  if (version.status === 'approved') return c.json({ error: 'Version is already approved.' }, 400);
  if (version.status === 'rejected') return c.json({ error: 'A rejected version cannot be approved. Please upload a new revision.' }, 400);

  // Demote any currently-live version, mark all other versions for this month superseded, promote this one
  await db.batch([
    db.prepare(`UPDATE data_versions SET is_current_live = 0 WHERE is_current_live = 1`),
    db.prepare(`UPDATE data_versions SET status = 'superseded' WHERE month_label = ? AND id != ? AND status = 'approved'`).bind(version.month_label, versionId),
    db
      .prepare(
        `UPDATE data_versions SET status = 'approved', is_current_live = 1, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, reporting_month_confirmed = 1 WHERE id = ?`
      )
      .bind(user.id, body?.notes ?? null, versionId),
  ]);

  await logAudit(db, user, 'VERSION_APPROVED', 'data_version', String(versionId), { month_label: version.month_label, version_number: version.version_number, notes: body?.notes });

  return c.json({ ok: true, version_id: versionId });
});

// ============================================================
// REJECT
// ============================================================
adminRoutes.post('/versions/:id/reject', async (c) => {
  const db = c.env.DB;
  const user = c.get('user') as AuthUser;
  const versionId = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const version = await getVersionById(db, versionId);
  if (!version) return c.json({ error: 'Version not found.' }, 404);
  if (version.status === 'approved') return c.json({ error: 'An approved/live version cannot be rejected. Restore a previous version instead.' }, 400);

  await db
    .prepare(`UPDATE data_versions SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ?`)
    .bind(user.id, body?.reason ?? 'No reason provided.', versionId)
    .run();

  await logAudit(db, user, 'VERSION_REJECTED', 'data_version', String(versionId), { reason: body?.reason });
  return c.json({ ok: true });
});

// ============================================================
// RESTORE — re-promote a previously approved (now superseded) version to live
// ============================================================
adminRoutes.post('/versions/:id/restore', async (c) => {
  const db = c.env.DB;
  const user = c.get('user') as AuthUser;
  const versionId = Number(c.req.param('id'));
  const version = await getVersionById(db, versionId);
  if (!version) return c.json({ error: 'Version not found.' }, 404);
  if (version.status !== 'superseded' && version.status !== 'approved') {
    return c.json({ error: 'Only a previously approved version can be restored.' }, 400);
  }

  await db.batch([
    db.prepare(`UPDATE data_versions SET is_current_live = 0 WHERE is_current_live = 1`),
    db.prepare(`UPDATE data_versions SET status = 'approved', is_current_live = 1 WHERE id = ?`).bind(versionId),
  ]);

  await logAudit(db, user, 'VERSION_RESTORED', 'data_version', String(versionId), { month_label: version.month_label, version_number: version.version_number });
  return c.json({ ok: true });
});

// ============================================================
// VERSION LIST + AUDIT TRAIL
// ============================================================
adminRoutes.get('/versions', async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT * FROM data_versions ORDER BY month_label DESC, version_number DESC').all();
  return c.json({ versions: results });
});

adminRoutes.get('/audit-log', async (c) => {
  const db = c.env.DB;
  const limit = Math.min(Number(c.req.query('limit') || 200), 1000);
  const { results } = await db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').bind(limit).all();
  return c.json({
    entries: (results || []).map((r: any) => ({ ...r, details: r.details_json ? JSON.parse(r.details_json) : null })),
  });
});

// ============================================================
// SOURCE MANAGEMENT (list distinct sources referenced across the live dataset)
// ============================================================
adminRoutes.get('/sources', async (c) => {
  const db = c.env.DB;
  const live = await getLiveVersion(db);
  if (!live) return c.json({ sources: [] });
  const { results } = await db
    .prepare('SELECT primary_source_url, independent_source_url, module FROM records WHERE version_id = ?')
    .bind(live.id)
    .all();
  const seen = new Map<string, { url: string; modules: Set<string>; type: string }>();
  for (const r of results as any[]) {
    if (r.primary_source_url) {
      const key = r.primary_source_url;
      if (!seen.has(key)) seen.set(key, { url: key, modules: new Set(), type: 'primary' });
      seen.get(key)!.modules.add(r.module);
    }
    if (r.independent_source_url) {
      const key = r.independent_source_url;
      if (!seen.has(key)) seen.set(key, { url: key, modules: new Set(), type: 'independent' });
      seen.get(key)!.modules.add(r.module);
    }
  }
  return c.json({
    sources: Array.from(seen.values()).map((s) => ({ url: s.url, type: s.type, modules: Array.from(s.modules) })),
  });
});

// ============================================================
// DIRECT RECORD EDIT (Super Admin database editing capability)
// ============================================================
adminRoutes.put('/records/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user') as AuthUser;
  const recordId = Number(c.req.param('id'));
  const body = await c.req.json<{ data: Record<string, any>; confidence_level?: string; validation_status?: string; conflict_notes?: string }>();

  const existing = await db.prepare('SELECT * FROM records WHERE id = ?').bind(recordId).first<any>();
  if (!existing) return c.json({ error: 'Record not found.' }, 404);

  const newDataJson = JSON.stringify(body.data);
  await db
    .prepare(
      `UPDATE records SET data_json = ?, confidence_level = COALESCE(?, confidence_level), validation_status = COALESCE(?, validation_status), conflict_notes = COALESCE(?, conflict_notes) WHERE id = ?`
    )
    .bind(newDataJson, body.confidence_level ?? null, body.validation_status ?? null, body.conflict_notes ?? null, recordId)
    .run();

  await db
    .prepare(
      `INSERT INTO record_edits (record_id, version_id, module, record_key, edited_by, previous_data_json, new_data_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(recordId, existing.version_id, existing.module, existing.record_key, user.id, existing.data_json, newDataJson)
    .run();

  await logAudit(db, user, 'RECORD_EDITED', 'record', String(recordId), { module: existing.module, record_key: existing.record_key });

  return c.json({ ok: true });
});

// ============================================================
// USER MANAGEMENT
// ============================================================
adminRoutes.get('/users', async (c) => {
  const db = c.env.DB;
  const { results } = await db
    .prepare('SELECT id, username, email, role, org_id, display_name, can_upload, can_export, is_active, created_at, last_login_at FROM users ORDER BY id')
    .all();
  return c.json({ users: results });
});

adminRoutes.post('/users', async (c) => {
  const db = c.env.DB;
  const admin = c.get('user') as AuthUser;
  const body = await c.req.json<{ username: string; password: string; role: string; email?: string; display_name?: string; org_id?: number; can_upload?: boolean; can_export?: boolean }>();

  if (!body.username || !body.password || !body.role) return c.json({ error: 'username, password, and role are required.' }, 400);
  if (!['super_admin', 'demo', 'single_user', 'multi_user'].includes(body.role)) return c.json({ error: 'Invalid role.' }, 400);

  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(body.username).first();
  if (existing) return c.json({ error: 'Username already exists.' }, 409);

  const { hash, salt } = await hashPassword(body.password);
  const result = await db
    .prepare(
      `INSERT INTO users (username, email, password_hash, password_salt, role, org_id, display_name, can_upload, can_export, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      body.username,
      body.email ?? null,
      hash,
      salt,
      body.role,
      body.org_id ?? null,
      body.display_name ?? body.username,
      body.role === 'super_admin' ? 1 : body.can_upload ? 1 : 0,
      body.can_export === false ? 0 : 1,
      admin.id
    )
    .run();

  await logAudit(db, admin, 'USER_CREATED', 'user', String(result.meta.last_row_id), { username: body.username, role: body.role });
  return c.json({ ok: true, id: result.meta.last_row_id });
});

adminRoutes.put('/users/:id', async (c) => {
  const db = c.env.DB;
  const admin = c.get('user') as AuthUser;
  const userId = Number(c.req.param('id'));
  const body = await c.req.json<{ role?: string; is_active?: boolean; can_upload?: boolean; can_export?: boolean; display_name?: string; org_id?: number | null; password?: string }>();

  const existing = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<any>();
  if (!existing) return c.json({ error: 'User not found.' }, 404);

  const updates: string[] = [];
  const params: any[] = [];
  if (body.role !== undefined) { updates.push('role = ?'); params.push(body.role); }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); params.push(body.is_active ? 1 : 0); }
  if (body.can_upload !== undefined) { updates.push('can_upload = ?'); params.push(body.can_upload ? 1 : 0); }
  if (body.can_export !== undefined) { updates.push('can_export = ?'); params.push(body.can_export ? 1 : 0); }
  if (body.display_name !== undefined) { updates.push('display_name = ?'); params.push(body.display_name); }
  if (body.org_id !== undefined) { updates.push('org_id = ?'); params.push(body.org_id); }
  if (body.password) {
    const { hash, salt } = await hashPassword(body.password);
    updates.push('password_hash = ?', 'password_salt = ?');
    params.push(hash, salt);
  }
  if (updates.length === 0) return c.json({ error: 'No fields to update.' }, 400);

  params.push(userId);
  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  await logAudit(db, admin, 'USER_UPDATED', 'user', String(userId), { fields: Object.keys(body) });
  return c.json({ ok: true });
});

adminRoutes.delete('/users/:id', async (c) => {
  const db = c.env.DB;
  const admin = c.get('user') as AuthUser;
  const userId = Number(c.req.param('id'));
  if (userId === admin.id) return c.json({ error: 'You cannot deactivate your own account.' }, 400);
  await db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(userId).run();
  await logAudit(db, admin, 'USER_DEACTIVATED', 'user', String(userId));
  return c.json({ ok: true });
});

// ============================================================
// ORGANIZATIONS (Multi User team management)
// ============================================================
adminRoutes.get('/organizations', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM organizations ORDER BY id').all();
  return c.json({ organizations: results });
});

adminRoutes.post('/organizations', async (c) => {
  const db = c.env.DB;
  const admin = c.get('user') as AuthUser;
  const body = await c.req.json<{ name: string }>();
  if (!body.name) return c.json({ error: 'name is required.' }, 400);
  const result = await db.prepare('INSERT INTO organizations (name) VALUES (?)').bind(body.name).run();
  await logAudit(db, admin, 'ORG_CREATED', 'organization', String(result.meta.last_row_id), { name: body.name });
  return c.json({ ok: true, id: result.meta.last_row_id });
});
