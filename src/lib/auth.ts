import type { Context } from 'hono';
import type { Bindings, AuthUser, Role } from './types';

// ---------- Password hashing (PBKDF2-SHA256, Web Crypto — Workers-compatible) ----------

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt.buffer as ArrayBuffer) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const result = await hashPassword(password, salt);
  return result.hash === hash;
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes.buffer as ArrayBuffer);
}

// ---------- Session helpers ----------

const SESSION_TTL_HOURS = 24 * 7; // 7 days

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expires).run();
  return token;
}

export async function getUserFromToken(db: D1Database, token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.org_id, u.display_name, u.can_upload, u.can_export
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = 1`
    )
    .bind(token)
    .first();
  if (!row) return null;
  return row as unknown as AuthUser;
}

export function extractToken(c: Context): string | null {
  const header = c.req.header('Authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  const cookie = c.req.header('Cookie');
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)ivct_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

// ---------- Role helpers ----------

export const UPLOAD_ROLES: Role[] = ['super_admin'];

export function canUpload(user: AuthUser): boolean {
  return user.role === 'super_admin';
}
export function canManageUsers(user: AuthUser): boolean {
  return user.role === 'super_admin';
}
export function canEditRecords(user: AuthUser): boolean {
  return user.role === 'super_admin';
}
export function canViewUnpublished(user: AuthUser): boolean {
  return user.role === 'super_admin';
}
export function canExport(user: AuthUser): boolean {
  if (user.role === 'demo') return false;
  return !!user.can_export;
}

export async function logAudit(
  db: D1Database,
  user: AuthUser | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: unknown
) {
  await db
    .prepare(
      'INSERT INTO audit_log (user_id, username, role, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      user?.id ?? null,
      user?.username ?? null,
      user?.role ?? null,
      action,
      entityType ?? null,
      entityId ?? null,
      details ? JSON.stringify(details) : null
    )
    .run();
}
