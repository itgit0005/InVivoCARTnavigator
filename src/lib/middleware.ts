import type { Context, Next } from 'hono';
import type { Bindings, AuthUser } from './types';
import { extractToken, getUserFromToken } from './auth';

export async function requireAuth(c: Context<{ Bindings: Bindings; Variables: { user: AuthUser } }>, next: Next) {
  const token = extractToken(c);
  const user = token ? await getUserFromToken(c.env.DB, token) : null;
  if (!user) return c.json({ error: 'Authentication required.' }, 401);
  c.set('user', user);
  await next();
}

export async function requireSuperAdmin(c: Context<{ Bindings: Bindings; Variables: { user: AuthUser } }>, next: Next) {
  const user = c.get('user');
  if (!user || user.role !== 'super_admin') {
    return c.json({ error: 'This action requires Super Admin access.' }, 403);
  }
  await next();
}
