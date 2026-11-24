import crypto from 'node:crypto';
import path from 'node:path';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function hashSecret(value: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(value, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifySecret(value: string, storedHash: string, storedSalt: string): boolean {
  if (!storedHash || !storedSalt) return false;
  const derived = crypto.scryptSync(value, storedSalt, 64);
  const target = Buffer.from(storedHash, 'hex');
  if (derived.length !== target.length) return false;
  return crypto.timingSafeEqual(derived, target);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(36).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createMediaToken(mediaId: string, userId: string, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${mediaId}.${userId}.${exp}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyMediaToken(token: string, expectedMediaId: string): { userId: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [mediaId, userId, expStr, sig] = parts;
  if (mediaId !== expectedMediaId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const payload = `${mediaId}.${userId}.${expStr}`;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { userId };
}

export function sanitizeHttpUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function resolveSafeUploadPath(uploadDir: string, filename: string): string | null {
  if (!filename || filename.includes('\0')) return null;
  const baseDir = path.resolve(uploadDir);
  const target = path.resolve(baseDir, path.basename(filename));
  if (!target.startsWith(baseDir + path.sep)) return null;
  return target;
}

// In-memory rate limiter for auth/PIN endpoints
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxAttempts = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const existing = attempts.get(key);
  if (!existing || existing.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxAttempts) {
    return false;
  }
  existing.count += 1;
  return true;
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
