import { Hono } from 'hono';
import type { Bindings, AuthUser } from '../lib/types';
import { MODULES, MODULE_LABELS } from '../lib/types';
import { requireAuth } from '../lib/middleware';
import { getLiveVersion, getAllRecordsGroupedByModule, getApprovedVersionForMonth } from '../lib/data';

export const aiRoutes = new Hono<{ Bindings: Bindings; Variables: { user: AuthUser } }>();

aiRoutes.use('*', requireAuth);

function buildContextDocument(grouped: Record<string, any[]>): string {
  const parts: string[] = [];
  for (const mod of MODULES) {
    const rows = grouped[mod] || [];
    if (rows.length === 0) continue;
    parts.push(`\n### ${MODULE_LABELS[mod]} (${rows.length} records)`);
    for (const r of rows) {
      const { __meta, ...fields } = r.data;
      const line = Object.entries(fields)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      const srcParts: string[] = [];
      if (__meta?.primary_source_url) srcParts.push(`Primary Source: ${__meta.primary_source_url}`);
      if (__meta?.independent_source_url) srcParts.push(`Independent Source: ${__meta.independent_source_url}`);
      const src = srcParts.length ? ` [${srcParts.join(' | ')}]` : '';
      parts.push(`- ${line}${src}`);
    }
  }
  return parts.join('\n');
}

aiRoutes.post('/ask', async (c) => {
  const db = c.env.DB;
  const user = c.get('user') as AuthUser;
  const body = await c.req.json<{ question: string; month?: string }>().catch(() => null);
  if (!body?.question?.trim()) return c.json({ error: 'A question is required.' }, 400);

  const version = body.month ? await getApprovedVersionForMonth(db, body.month) : await getLiveVersion(db);
  if (!version) return c.json({ error: 'No approved data available to answer from.' }, 404);

  const grouped = await getAllRecordsGroupedByModule(db, version.id);
  const contextDoc = buildContextDocument(grouped as any);

  const apiKey = c.env.OPENAI_API_KEY;
  const baseUrl = c.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    return c.json({
      error: 'AI Analyst is not configured. An OPENAI_API_KEY secret must be set for this feature to work.',
    }, 503);
  }

  const systemPrompt = `You are the AI Analyst for the In Vivo CAR-T Intelligence Platform. You answer questions STRICTLY using the verified platform database provided below (data version: ${version.month_label} ${version.version_label}, cutoff ${version.data_cutoff_date}). 
Rules:
- Only use facts present in the provided database context. Do not use outside knowledge or make up information.
- If the database does not contain the answer, say so clearly — do not guess.
- Always cite sources: include the exact Primary Source and/or Independent Source URL(s) shown next to the facts you used, inline in your answer or in a "Sources" section at the end.
- Do not present preliminary Phase 1 data as definitive efficacy; note small sample sizes where relevant.
- Do not mark acquisitions as completed unless the record indicates closing was confirmed.
- Do not make unsupported "largest/first/only/most advanced" claims beyond what the database explicitly states.
- Be precise about dates, deal value structures (upfront vs. milestone vs. total), and development stage.

DATABASE CONTEXT:
${contextDoc}`;

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.question },
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return c.json({ error: `AI service error: ${errText}` }, 502);
    }

    const json = await resp.json<any>();
    const answer = json.choices?.[0]?.message?.content || 'No answer generated.';

    await db
      .prepare('INSERT INTO ai_queries (user_id, username, question, answer, sources_json) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, user.username, body.question, answer, JSON.stringify({ version_id: version.id }))
      .run();

    return c.json({ answer, version: { month_label: version.month_label, version_label: version.version_label, data_cutoff_date: version.data_cutoff_date } });
  } catch (e: any) {
    return c.json({ error: `AI Analyst failed: ${e.message || e}` }, 500);
  }
});

aiRoutes.get('/history', async (c) => {
  const user = c.get('user') as AuthUser;
  const db = c.env.DB;
  const query = user.role === 'super_admin'
    ? 'SELECT * FROM ai_queries ORDER BY id DESC LIMIT 100'
    : 'SELECT * FROM ai_queries WHERE user_id = ? ORDER BY id DESC LIMIT 50';
  const { results } = user.role === 'super_admin'
    ? await db.prepare(query).all()
    : await db.prepare(query).bind(user.id).all();
  return c.json({ history: results });
});
