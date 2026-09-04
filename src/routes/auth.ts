import { Hono } from 'hono';
import type { Bindings, AuthUser } from '../lib/types';
import { verifyPassword, createSession, getUserFromToken, extractToken, logAudit } from '../lib/auth';

export const authRoutes = new Hono<{ Bindings: Bindings }>();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>().catch(() => null);
  if (!body?.username || !body?.password) {
    return c.json({ error: 'Username and password are required.' }, 400);
  }
  const db = c.env.DB;
  const user = await db
    .prepare('SELECT * FROM users WHERE username = ? AND is_active = 1')
    .bind(body.username.trim())
    .first<any>();

  if (!user) {
    await logAudit(db, null, 'LOGIN_FAILED', 'user', body.username, { reason: 'not_found' });
    return c.json({ error: 'Invalid username or password.' }, 401);
  }

  const ok = await verifyPassword(body.password, user.password_hash, user.password_salt);
  if (!ok) {
    await logAudit(db, null, 'LOGIN_FAILED', 'user', body.username, { reason: 'bad_password' });
    return c.json({ error: 'Invalid username or password.' }, 401);
  }

  const token = await createSession(db, user.id);
  await db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    org_id: user.org_id,
    display_name: user.display_name,
    can_upload: user.can_upload,
    can_export: user.can_export,
  };
  await logAudit(db, authUser, 'LOGIN_SUCCESS', 'user', String(user.id));

  return c.json({ token, user: authUser });
});

authRoutes.post('/logout', async (c) => {
  const token = extractToken(c);
  if (token) {
    const user = await getUserFromToken(c.env.DB, token);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    if (user) await logAudit(c.env.DB, user, 'LOGOUT', 'user', String(user.id));
  }
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const token = extractToken(c);
  const user = token ? await getUserFromToken(c.env.DB, token) : null;
  if (!user) return c.json({ user: null }, 200);
  return c.json({ user });
});
