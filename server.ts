import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { WebSocketServer, type WebSocket } from 'ws';
import { db, UPLOAD_DIR } from './server/db.ts';
import { getQuoteForDayIndex } from './server/quotes.ts';
import {
  checkRateLimit,
  createMediaToken,
  generateSessionToken,
  hashSecret,
  hashToken,
  resetRateLimit,
  resolveSafeUploadPath,
  sanitizeHttpUrl,
  verifyMediaToken,
  verifySecret,
} from './server/security.ts';

interface AuthUser {
  id: string;
  username: string;
  display_name: string;
  email: string;
  pin_enabled: number;
  avatar_media_id: string;
  bio: string;
  mood_today: string;
  wallpaper_id: string;
  privacy_default: string;
  notify_messages: number;
  notify_friends: number;
  notify_capsules: number;
  created_at: string;
}

interface AuthedRequest extends Request {
  authUser?: AuthUser;
  sessionId?: string;
}

const app = express();
// CORS: lets the Vercel frontend call this backend. Set CORS_ORIGIN to your
// Vercel URL(s), comma-separated, e.g. https://dear-me.vercel.app
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});
app.use(express.json({ limit: '2mb' }));

// Configure Multer for secure local media uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
    const id = crypto.randomUUID();
    cb(null, `${id}${ext}`);
  },
});

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];
const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB max per file
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p))) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported media file type. Only image, video, and audio files are allowed.'));
    }
  },
});

// Helper functions
function nowIso(): string {
  return new Date().toISOString();
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatUserPublic(user: AuthUser, viewerId: string) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    bio: user.bio,
    moodToday: user.mood_today,
    avatarUrl: user.avatar_media_id ? `/api/media/${user.avatar_media_id}?mt=${createMediaToken(user.avatar_media_id, viewerId)}` : '',
    createdAt: user.created_at,
  };
}

function formatUserSelf(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    pinEnabled: Boolean(user.pin_enabled),
    avatarMediaId: user.avatar_media_id,
    avatarUrl: user.avatar_media_id ? `/api/media/${user.avatar_media_id}?mt=${createMediaToken(user.avatar_media_id, user.id)}` : '',
    bio: user.bio,
    moodToday: user.mood_today,
    wallpaperId: user.wallpaper_id,
    privacyDefault: user.privacy_default,
    notifyMessages: Boolean(user.notify_messages),
    notifyFriends: Boolean(user.notify_friends),
    notifyCapsules: Boolean(user.notify_capsules),
    createdAt: user.created_at,
  };
}

function buildMediaPayload(mediaRow: { id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }, viewerId: string) {
  return {
    id: mediaRow.id,
    mimeType: mediaRow.mime_type,
    kind: mediaRow.media_kind,
    originalName: mediaRow.original_name,
    sizeBytes: mediaRow.size_bytes,
    url: `/api/media/${mediaRow.id}?mt=${createMediaToken(mediaRow.id, viewerId)}`,
  };
}

function areFriends(userA: string, userB: string): boolean {
  if (userA === userB) return true;
  const row = db
    .prepare(
      `SELECT id FROM friendships
       WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
       AND status = 'accepted'`
    )
    .get(userA, userB, userB, userA);
  return Boolean(row);
}

function isBlockedBetween(userA: string, userB: string): boolean {
  const row = db
    .prepare(
      `SELECT id FROM friendships
       WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
       AND status = 'blocked'`
    )
    .get(userA, userB, userB, userA);
  return Boolean(row);
}

function authenticateBearer(token: string): { user: AuthUser; sessionId: string } | null {
  if (!token) return null;
  const tokenH = hashToken(token);
  const row = db
    .prepare(
      `SELECT s.id AS session_id, u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.is_revoked = 0`
    )
    .get(tokenH) as (AuthUser & { session_id: string }) | undefined;
  if (!row) return null;
  db.prepare(`UPDATE sessions SET last_active_at = ? WHERE id = ?`).run(nowIso(), row.session_id);
  const { session_id, ...user } = row;
  return { user, sessionId: session_id };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const result = authenticateBearer(token);
  if (!result) {
    res.status(401).json({ error: 'Authentication required. Please unlock your diary.' });
    return;
  }
  req.authUser = result.user;
  req.sessionId = result.sessionId;
  next();
}

function createNotification(userId: string, type: string, title: string, body: string, refId = '') {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, ref_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(id, userId, type, title, body, refId, createdAt);
  pushWsToUsers([userId], {
    type: 'notification:new',
    notification: { id, type, title, body, refId, isRead: false, createdAt },
  });
}

// WebSocket hub for realtime chat, typing, read receipts, and notifications
const wsClients = new Map<string, Set<WebSocket>>();

function pushWsToUsers(userIds: string[], payload: unknown) {
  const encoded = JSON.stringify(payload);
  for (const uid of userIds) {
    const sockets = wsClients.get(uid);
    if (!sockets) continue;
    for (const sock of sockets) {
      if (sock.readyState === 1) {
        sock.send(encoded);
      }
    }
  }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ================= AUTH & LOCK SCREEN =================

app.get('/api/auth/lock-preview', (req, res) => {
  const username = String(req.query.username || '').trim().toLowerCase();
  if (!username) {
    res.json({ found: false });
    return;
  }
  const user = db
    .prepare(`SELECT id, username, display_name, pin_enabled, wallpaper_id, avatar_media_id FROM users WHERE username = ?`)
    .get(username) as { id: string; username: string; display_name: string; pin_enabled: number; wallpaper_id: string; avatar_media_id: string } | undefined;
  if (!user) {
    res.json({ found: false });
    return;
  }
  res.json({
    found: true,
    username: user.username,
    displayName: user.display_name,
    pinEnabled: Boolean(user.pin_enabled),
    wallpaperId: user.wallpaper_id,
    avatarUrl: user.avatar_media_id ? `/api/media/${user.avatar_media_id}?mt=${createMediaToken(user.avatar_media_id, user.id)}` : '',
  });
});

app.post('/api/auth/register', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`reg:${ip}`, 15, 60_000)) {
    res.status(429).json({ error: 'Too many registration attempts. Please wait a moment.' });
    return;
  }

  const rawUsername = String(req.body?.username || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const pin = String(req.body?.pin || '').trim();

  if (!/^[a-z0-9_]{3,24}$/.test(rawUsername)) {
    res.status(400).json({ error: 'Username must be 3–24 characters using letters, numbers, or underscores.' });
    return;
  }
  if (displayName.length < 1 || displayName.length > 40) {
    res.status(400).json({ error: 'Display name must be 1–40 characters.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 6 || password.length > 128) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }
  if (pin && !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
    return;
  }

  const existing = db.prepare(`SELECT id FROM users WHERE username = ? OR email = ?`).get(rawUsername, email);
  if (existing) {
    res.status(409).json({ error: 'That username or email is already taken.' });
    return;
  }

  const userId = crypto.randomUUID();
  const pwd = hashSecret(password);
  const pinData = pin ? hashSecret(pin) : { hash: '', salt: '' };
  const recoveryCode = `PINK-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const rec = hashSecret(recoveryCode);
  const createdAt = nowIso();

  db.prepare(
    `INSERT INTO users (
      id, username, display_name, email, password_hash, password_salt,
      pin_hash, pin_salt, pin_enabled, recovery_code_hash, recovery_code_salt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    rawUsername,
    displayName,
    email,
    pwd.hash,
    pwd.salt,
    pinData.hash,
    pinData.salt,
    pin ? 1 : 0,
    rec.hash,
    rec.salt,
    createdAt
  );

  const token = generateSessionToken();
  const sessionId = crypto.randomUUID();
  const deviceLabel = String(req.headers['user-agent'] || 'Browser Session').slice(0, 120);
  db.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, device_label, created_at, last_active_at, is_revoked)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(sessionId, hashToken(token), userId, deviceLabel, createdAt, createdAt);

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as AuthUser;
  res.status(201).json({
    token,
    sessionId,
    recoveryCode,
    user: formatUserSelf(user),
  });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const limitKey = `login:${req.ip}:${username}`;
  if (!checkRateLimit(limitKey, 10, 60_000)) {
    res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
    return;
  }

  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as
    | (AuthUser & { password_hash: string; password_salt: string })
    | undefined;
  if (!row || !verifySecret(password, row.password_hash, row.password_salt)) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  resetRateLimit(limitKey);
  const token = generateSessionToken();
  const sessionId = crypto.randomUUID();
  const ts = nowIso();
  const deviceLabel = String(req.headers['user-agent'] || 'Browser Session').slice(0, 120);
  db.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, device_label, created_at, last_active_at, is_revoked)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(sessionId, hashToken(token), row.id, deviceLabel, ts, ts);

  res.json({
    token,
    sessionId,
    user: formatUserSelf(row),
  });
});

app.post('/api/auth/unlock-pin', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const pin = String(req.body?.pin || '').trim();
  const limitKey = `pin:${req.ip}:${username}`;
  if (!checkRateLimit(limitKey, 6, 60_000)) {
    res.status(429).json({ error: 'Too many PIN attempts. Please unlock with your password or wait a minute.' });
    return;
  }

  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as
    | (AuthUser & { pin_hash: string; pin_salt: string })
    | undefined;
  if (!row || !row.pin_enabled || !verifySecret(pin, row.pin_hash, row.pin_salt)) {
    res.status(401).json({ error: 'Incorrect PIN or PIN unlock is not enabled for this account.' });
    return;
  }

  resetRateLimit(limitKey);
  const token = generateSessionToken();
  const sessionId = crypto.randomUUID();
  const ts = nowIso();
  const deviceLabel = String(req.headers['user-agent'] || 'PIN Quick Unlock').slice(0, 120);
  db.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, device_label, created_at, last_active_at, is_revoked)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(sessionId, hashToken(token), row.id, deviceLabel, ts, ts);

  res.json({
    token,
    sessionId,
    user: formatUserSelf(row),
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const recoveryCode = String(req.body?.recoveryCode || '').trim().toUpperCase();
  const newPassword = String(req.body?.newPassword || '');

  if (!checkRateLimit(`reset:${req.ip}:${username}`, 6, 60_000)) {
    res.status(429).json({ error: 'Too many reset attempts. Please wait a minute.' });
    return;
  }
  if (newPassword.length < 6 || newPassword.length > 128) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }

  const row = db.prepare(`SELECT * FROM users WHERE username = ? AND email = ?`).get(username, email) as
    | (AuthUser & { recovery_code_hash: string; recovery_code_salt: string })
    | undefined;

  if (!row || !verifySecret(recoveryCode, row.recovery_code_hash, row.recovery_code_salt)) {
    res.status(401).json({ error: 'Username, email, or recovery code did not match.' });
    return;
  }

  const pwd = hashSecret(newPassword);
  const nextRecovery = `PINK-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const rec = hashSecret(nextRecovery);

  db.prepare(
    `UPDATE users SET password_hash = ?, password_salt = ?, recovery_code_hash = ?, recovery_code_salt = ? WHERE id = ?`
  ).run(pwd.hash, pwd.salt, rec.hash, rec.salt, row.id);
  db.prepare(`UPDATE sessions SET is_revoked = 1 WHERE user_id = ?`).run(row.id);

  res.json({
    ok: true,
    newRecoveryCode: nextRecovery,
  });
});

app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
  db.prepare(`UPDATE sessions SET is_revoked = 1 WHERE id = ? AND user_id = ?`).run(req.sessionId, req.authUser!.id);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: formatUserSelf(req.authUser!), sessionId: req.sessionId });
});

// ================= MEDIA UPLOAD & SECURE STREAMING =================

app.post('/api/media/upload', requireAuth, upload.array('files', 10), (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const scope = String(req.body?.scope || 'post');
  const scopeId = String(req.body?.scopeId || '');
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) {
    res.status(400).json({ error: 'Please select at least one file to upload.' });
    return;
  }

  const created: ReturnType<typeof buildMediaPayload>[] = [];
  const insertStmt = db.prepare(
    `INSERT INTO media_items (id, user_id, filename, original_name, mime_type, size_bytes, media_kind, owner_scope, scope_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const f of files) {
    const id = crypto.randomUUID();
    const kind = f.mimetype.startsWith('video/') ? 'video' : f.mimetype.startsWith('audio/') ? 'audio' : 'image';
    insertStmt.run(id, userId, f.filename, f.originalname.slice(0, 120), f.mimetype, f.size, kind, scope, scopeId, nowIso());
    created.push(
      buildMediaPayload(
        { id, mime_type: f.mimetype, media_kind: kind, original_name: f.originalname, size_bytes: f.size },
        userId
      )
    );
  }

  res.status(201).json({ media: created });
});

app.get('/api/media/:id', (req, res) => {
  const mediaId = req.params.id;
  const mt = String(req.query.mt || '');
  let viewerId = '';

  if (mt) {
    const verified = verifyMediaToken(mt, mediaId);
    if (!verified) {
      res.status(403).json({ error: 'Invalid or expired media token.' });
      return;
    }
    viewerId = verified.userId;
  } else {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const result = authenticateBearer(token);
    if (!result) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    viewerId = result.user.id;
  }

  const media = db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(mediaId) as
    | { id: string; user_id: string; filename: string; mime_type: string; owner_scope: string; scope_id: string }
    | undefined;
  if (!media) {
    res.status(404).json({ error: 'Media not found.' });
    return;
  }

  let allowed = media.user_id === viewerId;

  if (!allowed && media.owner_scope === 'avatar') {
    allowed = !isBlockedBetween(media.user_id, viewerId);
  } else if (!allowed && media.owner_scope === 'post') {
    const postRow = db
      .prepare(
        `SELECT p.user_id, p.visibility
         FROM post_media pm
         JOIN posts p ON p.id = pm.post_id
         WHERE pm.media_id = ?`
      )
      .get(media.id) as { user_id: string; visibility: string } | undefined;
    if (postRow && postRow.visibility === 'friends' && areFriends(postRow.user_id, viewerId)) {
      allowed = true;
    }
  } else if (!allowed && media.owner_scope === 'message') {
    const membership = db
      .prepare(
        `SELECT m.conversation_id
         FROM messages m
         JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
         WHERE m.media_id = ? AND cm.user_id = ?`
      )
      .get(media.id, viewerId);
    if (membership) {
      allowed = true;
    }
  }

  if (!allowed) {
    res.status(403).json({ error: 'You do not have permission to view this private media.' });
    return;
  }

  const safePath = resolveSafeUploadPath(UPLOAD_DIR, media.filename);
  if (!safePath || !fs.existsSync(safePath)) {
    res.status(404).json({ error: 'Media file missing.' });
    return;
  }

  res.setHeader('Content-Type', media.mime_type);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(safePath);
});

// ================= HOME DASHBOARD & MOOD =================

app.post('/api/mood', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const mood = String(req.body?.mood || 'dreamy').trim().slice(0, 32);
  const note = String(req.body?.note || '').trim().slice(0, 200);
  const dateStr = todayDateStr();
  const ts = nowIso();

  db.prepare(`UPDATE users SET mood_today = ? WHERE id = ?`).run(mood, userId);
  db.prepare(
    `INSERT INTO daily_moods (id, user_id, log_date, mood, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, log_date) DO UPDATE SET mood = excluded.mood, note = excluded.note`
  ).run(crypto.randomUUID(), userId, dateStr, mood, note, ts);

  res.json({ ok: true, mood, note, logDate: dateStr });
});

app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const today = todayDateStr();

  const recentPosts = db
    .prepare(`SELECT * FROM posts WHERE user_id = ? ORDER BY memory_date DESC, created_at DESC LIMIT 6`)
    .all(userId) as Array<Record<string, unknown>>;

  const enrichedPosts = recentPosts.map((p) => {
    const mediaRows = db
      .prepare(
        `SELECT m.* FROM post_media pm JOIN media_items m ON m.id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.sort_order ASC`
      )
      .all(p.id) as Array<{ id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }>;
    return {
      ...p,
      media: mediaRows.map((m) => buildMediaPayload(m, userId)),
    };
  });

  const recentVoices = db
    .prepare(
      `SELECT v.*, m.mime_type, m.media_kind, m.original_name, m.size_bytes
       FROM voice_notes v JOIN media_items m ON m.id = v.media_id
       WHERE v.user_id = ? ORDER BY v.created_at DESC LIMIT 3`
    )
    .all(userId) as Array<Record<string, unknown>>;

  const formattedVoices = recentVoices.map((v) => ({
    id: v.id,
    title: v.title,
    mood: v.mood,
    durationSec: v.duration_sec,
    recordedAt: v.recorded_at,
    createdAt: v.created_at,
    waveform: JSON.parse(String(v.waveform_json || '[]')),
    audioUrl: `/api/media/${v.media_id}?mt=${createMediaToken(String(v.media_id), userId)}`,
  }));

  const todayClaim = db
    .prepare(`SELECT * FROM heart_claims WHERE user_id = ? AND claim_date = ?`)
    .get(userId, today) as Record<string, unknown> | undefined;
  const claimCountRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM heart_claims WHERE user_id = ?`)
    .get(userId) as { cnt: number };

  // Friend shared activity (only explicitly friends-visible posts from accepted friends)
  const friendPosts = db
    .prepare(
      `SELECT p.*, u.username, u.display_name, u.avatar_media_id
       FROM posts p
       JOIN users u ON u.id = p.user_id
       JOIN friendships f ON (
         (f.requester_id = ? AND f.addressee_id = p.user_id) OR
         (f.addressee_id = ? AND f.requester_id = p.user_id)
       )
       WHERE f.status = 'accepted' AND p.visibility = 'friends'
       ORDER BY p.created_at DESC LIMIT 6`
    )
    .all(userId, userId) as Array<Record<string, unknown>>;

  const formattedFriendActivity = friendPosts.map((fp) => {
    const mediaRows = db
      .prepare(
        `SELECT m.* FROM post_media pm JOIN media_items m ON m.id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.sort_order ASC`
      )
      .all(fp.id) as Array<{ id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }>;
    return {
      id: fp.id,
      title: fp.title,
      caption: fp.caption,
      mood: fp.mood,
      postType: fp.post_type,
      memoryDate: fp.memory_date,
      createdAt: fp.created_at,
      author: {
        id: fp.user_id,
        username: fp.username,
        displayName: fp.display_name,
        avatarUrl: fp.avatar_media_id
          ? `/api/media/${fp.avatar_media_id}?mt=${createMediaToken(String(fp.avatar_media_id), userId)}`
          : '',
      },
      media: mediaRows.map((m) => buildMediaPayload(m, userId)),
    };
  });

  const unreadNotifications = db
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 8`)
    .all(userId) as Array<Record<string, unknown>>;

  // Unread messages count across conversations
  const unreadMsgsRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM messages m
       JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
       WHERE cm.user_id = ? AND m.sender_id != ? AND (cm.last_read_at = '' OR m.created_at > cm.last_read_at)`
    )
    .get(userId, userId) as { cnt: number };

  // On This Day quick check
  const mmdd = today.slice(5); // MM-DD
  const currentYear = Number(today.slice(0, 4));
  const onThisDayRows = db
    .prepare(
      `SELECT * FROM posts WHERE user_id = ? AND substr(memory_date, 6) = ? AND CAST(substr(memory_date, 1, 4) AS INTEGER) < ?
       ORDER BY memory_date DESC LIMIT 4`
    )
    .all(userId, mmdd, currentYear) as Array<Record<string, unknown>>;

  const onThisDay = onThisDayRows.map((p) => {
    const mediaRows = db
      .prepare(
        `SELECT m.* FROM post_media pm JOIN media_items m ON m.id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.sort_order ASC`
      )
      .all(p.id) as Array<{ id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }>;
    return {
      ...p,
      yearsAgo: currentYear - Number(String(p.memory_date).slice(0, 4)),
      media: mediaRows.map((m) => buildMediaPayload(m, userId)),
    };
  });

  const todayMoodRow = db
    .prepare(`SELECT mood, note FROM daily_moods WHERE user_id = ? AND log_date = ?`)
    .get(userId, today) as { mood: string; note: string } | undefined;

  res.json({
    recentPosts: enrichedPosts,
    recentVoices: formattedVoices,
    todayClaim: todayClaim || null,
    totalClaims: claimCountRow.cnt,
    friendActivity: formattedFriendActivity,
    notifications: unreadNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      refId: n.ref_id,
      isRead: Boolean(n.is_read),
      createdAt: n.created_at,
    })),
    unreadMessagesCount: unreadMsgsRow.cnt,
    onThisDay,
    todayMood: todayMoodRow || { mood: req.authUser!.mood_today, note: '' },
  });
});

// ================= MY LITTLE LIFE (POSTS & ON THIS DAY) =================

app.get('/api/posts', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const rows = db
    .prepare(`SELECT * FROM posts WHERE user_id = ? ORDER BY memory_date DESC, created_at DESC`)
    .all(userId) as Array<Record<string, unknown>>;

  const posts = rows.map((p) => {
    const mediaRows = db
      .prepare(
        `SELECT m.* FROM post_media pm JOIN media_items m ON m.id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.sort_order ASC`
      )
      .all(p.id) as Array<{ id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }>;
    return {
      id: p.id,
      title: p.title,
      caption: p.caption,
      mood: p.mood,
      postType: p.post_type,
      visibility: p.visibility,
      memoryDate: p.memory_date,
      createdAt: p.created_at,
      media: mediaRows.map((m) => buildMediaPayload(m, userId)),
    };
  });

  res.json({ posts });
});

app.post('/api/posts', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const title = String(req.body?.title || '').trim().slice(0, 120);
  const caption = String(req.body?.caption || '').trim().slice(0, 2000);
  const mood = String(req.body?.mood || 'sparkly').trim().slice(0, 40);
  const postType = ['photo', 'photodump', 'vlog', 'moment'].includes(req.body?.postType)
    ? req.body.postType
    : 'photo';
  const visibility = req.body?.visibility === 'friends' ? 'friends' : 'private';
  const memoryDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.memoryDate || ''))
    ? String(req.body.memoryDate)
    : todayDateStr();
  const mediaIds: string[] = Array.isArray(req.body?.mediaIds) ? req.body.mediaIds.map(String) : [];

  if (!title && !caption && mediaIds.length === 0) {
    res.status(400).json({ error: 'Add a title, caption, or photo/video for your diary entry.' });
    return;
  }

  const postId = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO posts (id, user_id, title, caption, mood, post_type, visibility, memory_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(postId, userId, title || 'Untitled Memory', caption, mood, postType, visibility, memoryDate, createdAt);

  const linkStmt = db.prepare(`INSERT INTO post_media (id, post_id, media_id, sort_order) VALUES (?, ?, ?, ?)`);
  mediaIds.forEach((mId, idx) => {
    const owned = db.prepare(`SELECT id FROM media_items WHERE id = ? AND user_id = ?`).get(mId, userId);
    if (owned) {
      db.prepare(`UPDATE media_items SET owner_scope = 'post', scope_id = ? WHERE id = ?`).run(postId, mId);
      linkStmt.run(crypto.randomUUID(), postId, mId, idx);
    }
  });

  res.status(201).json({ id: postId });
});

app.patch('/api/posts/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const post = db.prepare(`SELECT * FROM posts WHERE id = ? AND user_id = ?`).get(req.params.id, userId) as
    | Record<string, unknown>
    | undefined;
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  const visibility = req.body?.visibility === 'friends' ? 'friends' : 'private';
  const title = req.body?.title !== undefined ? String(req.body.title).trim().slice(0, 120) : String(post.title);
  const caption = req.body?.caption !== undefined ? String(req.body.caption).trim().slice(0, 2000) : String(post.caption);
  db.prepare(`UPDATE posts SET visibility = ?, title = ?, caption = ? WHERE id = ? AND user_id = ?`).run(
    visibility,
    title,
    caption,
    req.params.id,
    userId
  );
  res.json({ ok: true });
});

app.delete('/api/posts/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const result = db.prepare(`DELETE FROM posts WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/on-this-day', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const today = todayDateStr();
  const mmdd = today.slice(5);
  const currentYear = Number(today.slice(0, 4));
  const targetYears = [1, 2, 3, 5];

  const rows = db
    .prepare(
      `SELECT * FROM posts WHERE user_id = ? AND substr(memory_date, 6) = ? AND CAST(substr(memory_date, 1, 4) AS INTEGER) < ?
       ORDER BY memory_date DESC`
    )
    .all(userId, mmdd, currentYear) as Array<Record<string, unknown>>;

  const items = rows.map((p) => {
    const mediaRows = db
      .prepare(
        `SELECT m.* FROM post_media pm JOIN media_items m ON m.id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.sort_order ASC`
      )
      .all(p.id) as Array<{ id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }>;
    return {
      id: p.id,
      title: p.title,
      caption: p.caption,
      mood: p.mood,
      memoryDate: p.memory_date,
      yearsAgo: currentYear - Number(String(p.memory_date).slice(0, 4)),
      media: mediaRows.map((m) => buildMediaPayload(m, userId)),
    };
  });

  // Also return all past-year posts if user wants to browse nostalgic archive
  const archiveRows = db
    .prepare(
      `SELECT * FROM posts WHERE user_id = ? AND CAST(substr(memory_date, 1, 4) AS INTEGER) < ?
       ORDER BY memory_date DESC LIMIT 20`
    )
    .all(userId, currentYear) as Array<Record<string, unknown>>;

  const archive = archiveRows.map((p) => {
    const mediaRows = db
      .prepare(
        `SELECT m.* FROM post_media pm JOIN media_items m ON m.id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.sort_order ASC`
      )
      .all(p.id) as Array<{ id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }>;
    return {
      id: p.id,
      title: p.title,
      caption: p.caption,
      mood: p.mood,
      memoryDate: p.memory_date,
      yearsAgo: currentYear - Number(String(p.memory_date).slice(0, 4)),
      media: mediaRows.map((m) => buildMediaPayload(m, userId)),
    };
  });

  res.json({ today, targetYears, items, archive });
});

// ================= VOICE DIARY (PRIVATE) =================

app.get('/api/voice-notes', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const rows = db
    .prepare(
      `SELECT v.*, m.mime_type, m.size_bytes
       FROM voice_notes v JOIN media_items m ON m.id = v.media_id
       WHERE v.user_id = ? ORDER BY v.created_at DESC`
    )
    .all(userId) as Array<Record<string, unknown>>;

  res.json({
    voiceNotes: rows.map((v) => ({
      id: v.id,
      title: v.title,
      mood: v.mood,
      durationSec: v.duration_sec,
      waveform: JSON.parse(String(v.waveform_json || '[]')),
      recordedAt: v.recorded_at,
      createdAt: v.created_at,
      audioUrl: `/api/media/${v.media_id}?mt=${createMediaToken(String(v.media_id), userId)}`,
    })),
  });
});

app.post('/api/voice-notes', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const title = String(req.body?.title || 'Late Night Voice Memo').trim().slice(0, 120);
  const mood = String(req.body?.mood || 'reflective').trim().slice(0, 40);
  const durationSec = Math.max(0, Number(req.body?.durationSec || 0));
  const mediaId = String(req.body?.mediaId || '');
  const waveform = Array.isArray(req.body?.waveform) ? req.body.waveform.slice(0, 64).map(Number) : [];

  const ownedMedia = db.prepare(`SELECT id FROM media_items WHERE id = ? AND user_id = ?`).get(mediaId, userId);
  if (!ownedMedia) {
    res.status(400).json({ error: 'Valid audio recording is required.' });
    return;
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  db.prepare(`UPDATE media_items SET owner_scope = 'voice', scope_id = ? WHERE id = ?`).run(id, mediaId);
  db.prepare(
    `INSERT INTO voice_notes (id, user_id, title, mood, duration_sec, media_id, waveform_json, recorded_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, title, mood, durationSec, mediaId, JSON.stringify(waveform), ts, ts);

  res.status(201).json({ id });
});

app.delete('/api/voice-notes/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const result = db.prepare(`DELETE FROM voice_notes WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Voice note not found.' });
    return;
  }
  res.json({ ok: true });
});

// ================= THINGS I LOVE (PRIVATE) =================

app.get('/api/love-items', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const rows = db
    .prepare(`SELECT * FROM love_items WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId) as Array<Record<string, unknown>>;

  res.json({
    items: rows.map((item) => ({
      id: item.id,
      category: item.category,
      collectionName: item.collection_name,
      title: item.title,
      note: item.note,
      linkUrl: item.link_url,
      imageUrl: item.media_id
        ? `/api/media/${item.media_id}?mt=${createMediaToken(String(item.media_id), userId)}`
        : '',
      createdAt: item.created_at,
    })),
  });
});

app.post('/api/love-items', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const category = String(req.body?.category || 'Custom').trim().slice(0, 40);
  const collectionName = String(req.body?.collectionName || 'My Board').trim().slice(0, 60);
  const title = String(req.body?.title || '').trim().slice(0, 120);
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  const linkUrl = sanitizeHttpUrl(req.body?.linkUrl);
  const mediaId = String(req.body?.mediaId || '');

  if (!title) {
    res.status(400).json({ error: 'Please add a title for this favourite.' });
    return;
  }

  let validMediaId = '';
  if (mediaId) {
    const owned = db.prepare(`SELECT id FROM media_items WHERE id = ? AND user_id = ?`).get(mediaId, userId);
    if (owned) {
      validMediaId = mediaId;
    }
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  if (validMediaId) {
    db.prepare(`UPDATE media_items SET owner_scope = 'love', scope_id = ? WHERE id = ?`).run(id, validMediaId);
  }
  db.prepare(
    `INSERT INTO love_items (id, user_id, category, collection_name, title, note, media_id, link_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, category, collectionName, title, note, validMediaId, linkUrl, ts);

  res.status(201).json({ id });
});

app.delete('/api/love-items/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const result = db.prepare(`DELETE FROM love_items WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }
  res.json({ ok: true });
});

// ================= CLAIM YOUR HEART =================

app.get('/api/heart-claims', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const today = todayDateStr();
  const rows = db
    .prepare(`SELECT * FROM heart_claims WHERE user_id = ? ORDER BY claim_date DESC`)
    .all(userId) as Array<Record<string, unknown>>;

  const todayClaim = rows.find((r) => r.claim_date === today) || null;
  res.json({
    today,
    todayClaim: todayClaim
      ? {
          id: todayClaim.id,
          claimDate: todayClaim.claim_date,
          quoteIndex: todayClaim.quote_index,
          quoteText: todayClaim.quote_text,
          quoteAuthor: todayClaim.quote_author,
          isFavorite: Boolean(todayClaim.is_favorite),
        }
      : null,
    archive: rows.map((r) => ({
      id: r.id,
      claimDate: r.claim_date,
      quoteIndex: r.quote_index,
      quoteText: r.quote_text,
      quoteAuthor: r.quote_author,
      isFavorite: Boolean(r.is_favorite),
      createdAt: r.created_at,
    })),
    totalClaimed: rows.length,
  });
});

app.post('/api/heart-claims/claim', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const today = todayDateStr();
  const existing = db.prepare(`SELECT * FROM heart_claims WHERE user_id = ? AND claim_date = ?`).get(userId, today) as
    | Record<string, unknown>
    | undefined;
  if (existing) {
    res.json({
      claim: {
        id: existing.id,
        claimDate: existing.claim_date,
        quoteIndex: existing.quote_index,
        quoteText: existing.quote_text,
        quoteAuthor: existing.quote_author,
        isFavorite: Boolean(existing.is_favorite),
      },
      alreadyClaimed: true,
    });
    return;
  }

  const countRow = db.prepare(`SELECT COUNT(*) AS cnt FROM heart_claims WHERE user_id = ?`).get(userId) as { cnt: number };
  const dayOffset = getDayOfYear() + countRow.cnt;
  const quote = getQuoteForDayIndex(dayOffset);
  const id = crypto.randomUUID();
  const ts = nowIso();

  db.prepare(
    `INSERT INTO heart_claims (id, user_id, claim_date, quote_index, quote_text, quote_author, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(id, userId, today, quote.index, quote.text, quote.author, ts);

  res.status(201).json({
    claim: {
      id,
      claimDate: today,
      quoteIndex: quote.index,
      quoteText: quote.text,
      quoteAuthor: quote.author,
      isFavorite: false,
    },
    alreadyClaimed: false,
  });
});

app.patch('/api/heart-claims/:id/favorite', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const row = db.prepare(`SELECT id, is_favorite FROM heart_claims WHERE id = ? AND user_id = ?`).get(req.params.id, userId) as
    | { id: string; is_favorite: number }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Quote claim not found.' });
    return;
  }
  const next = row.is_favorite ? 0 : 1;
  db.prepare(`UPDATE heart_claims SET is_favorite = ? WHERE id = ?`).run(next, row.id);
  res.json({ isFavorite: Boolean(next) });
});

// ================= LETTERS TO MYSELF (PRIVATE) =================

app.get('/api/letters', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const today = todayDateStr();
  const rows = db
    .prepare(`SELECT * FROM letters WHERE user_id = ? ORDER BY deliver_on ASC, created_at DESC`)
    .all(userId) as Array<Record<string, unknown>>;

  res.json({
    today,
    letters: rows.map((l) => {
      const deliverOn = String(l.deliver_on);
      const isLocked = deliverOn > today;
      return {
        id: l.id,
        title: l.title,
        body: isLocked ? '' : l.body,
        sealColor: l.seal_color,
        stationeryStyle: l.stationery_style,
        deliverOn,
        isLocked,
        createdAt: l.created_at,
      };
    }),
  });
});

app.post('/api/letters', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const title = String(req.body?.title || '').trim().slice(0, 120);
  const body = String(req.body?.body || '').trim().slice(0, 8000);
  const sealColor = String(req.body?.sealColor || '#F20B83').slice(0, 20);
  const stationeryStyle = String(req.body?.stationeryStyle || 'rose-lace').slice(0, 30);
  const deliverOn = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.deliverOn || ''))
    ? String(req.body.deliverOn)
    : todayDateStr();

  if (!title || !body) {
    res.status(400).json({ error: 'Please write a subject and letter body.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO letters (id, user_id, title, body, seal_color, stationery_style, deliver_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, title, body, sealColor, stationeryStyle, deliverOn, nowIso());

  res.status(201).json({ id });
});

app.delete('/api/letters/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const result = db.prepare(`DELETE FROM letters WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Letter not found.' });
    return;
  }
  res.json({ ok: true });
});

// ================= TIME CAPSULES (PRIVATE) =================

app.get('/api/capsules', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const currentIso = nowIso();
  const rows = db
    .prepare(`SELECT * FROM capsules WHERE user_id = ? ORDER BY unlock_at ASC`)
    .all(userId) as Array<Record<string, unknown>>;

  const capsules = rows.map((c) => {
    const unlockAt = String(c.unlock_at);
    const isLocked = new Date(unlockAt).getTime() > new Date(currentIso).getTime();
    let media: ReturnType<typeof buildMediaPayload>[] = [];
    if (!isLocked) {
      const mRows = db
        .prepare(`SELECT m.* FROM capsule_media cm JOIN media_items m ON m.id = cm.media_id WHERE cm.capsule_id = ?`)
        .all(c.id) as Array<{ id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }>;
      media = mRows.map((m) => buildMediaPayload(m, userId));
    }
    const mediaCountRow = db.prepare(`SELECT COUNT(*) AS cnt FROM capsule_media WHERE capsule_id = ?`).get(c.id) as {
      cnt: number;
    };

    return {
      id: c.id,
      title: c.title,
      message: isLocked ? '' : c.message,
      unlockAt,
      themeBox: c.theme_box,
      isLocked,
      mediaCount: mediaCountRow.cnt,
      media,
      createdAt: c.created_at,
    };
  });

  res.json({ capsules });
});

app.post('/api/capsules', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const title = String(req.body?.title || '').trim().slice(0, 120);
  const message = String(req.body?.message || '').trim().slice(0, 6000);
  const unlockAtRaw = String(req.body?.unlockAt || '');
  const themeBox = String(req.body?.themeBox || 'pink-velvet').slice(0, 30);
  const mediaIds: string[] = Array.isArray(req.body?.mediaIds) ? req.body.mediaIds.map(String) : [];

  const parsedDate = new Date(unlockAtRaw);
  if (!title || Number.isNaN(parsedDate.getTime())) {
    res.status(400).json({ error: 'Please enter a capsule title and valid unlock date.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO capsules (id, user_id, title, message, unlock_at, theme_box, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, title, message, parsedDate.toISOString(), themeBox, nowIso());

  const linkStmt = db.prepare(`INSERT INTO capsule_media (id, capsule_id, media_id) VALUES (?, ?, ?)`);
  for (const mId of mediaIds) {
    const owned = db.prepare(`SELECT id FROM media_items WHERE id = ? AND user_id = ?`).get(mId, userId);
    if (owned) {
      db.prepare(`UPDATE media_items SET owner_scope = 'capsule', scope_id = ? WHERE id = ?`).run(id, mId);
      linkStmt.run(crypto.randomUUID(), id, mId);
    }
  }

  res.status(201).json({ id });
});

app.delete('/api/capsules/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const result = db.prepare(`DELETE FROM capsules WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Time capsule not found.' });
    return;
  }
  res.json({ ok: true });
});

// ================= MY PEOPLE (FRIENDS, REQUESTS, BLOCKS, PROFILES) =================

app.get('/api/people', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;

  const friendRows = db
    .prepare(
      `SELECT f.id AS friendship_id, f.status, f.requester_id, f.addressee_id,
              u.id, u.username, u.display_name, u.avatar_media_id, u.bio, u.mood_today, u.created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status IN ('accepted', 'pending')`
    )
    .all(userId, userId, userId) as Array<AuthUser & { friendship_id: string; status: string; requester_id: string; addressee_id: string }>;

  const friends = friendRows
    .filter((r) => r.status === 'accepted')
    .map((r) => ({ ...formatUserPublic(r, userId), friendshipId: r.friendship_id }));

  const incomingRequests = friendRows
    .filter((r) => r.status === 'pending' && r.addressee_id === userId)
    .map((r) => ({ ...formatUserPublic(r, userId), friendshipId: r.friendship_id }));

  const outgoingRequests = friendRows
    .filter((r) => r.status === 'pending' && r.requester_id === userId)
    .map((r) => ({ ...formatUserPublic(r, userId), friendshipId: r.friendship_id }));

  const blockedRows = db
    .prepare(
      `SELECT f.id AS friendship_id, u.id, u.username, u.display_name, u.avatar_media_id, u.bio, u.mood_today, u.created_at
       FROM friendships f
       JOIN users u ON u.id = f.addressee_id
       WHERE f.requester_id = ? AND f.status = 'blocked'`
    )
    .all(userId) as Array<AuthUser & { friendship_id: string }>;

  res.json({
    friends,
    incomingRequests,
    outgoingRequests,
    blocked: blockedRows.map((r) => ({ ...formatUserPublic(r, userId), friendshipId: r.friendship_id })),
  });
});

app.get('/api/people/search', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    res.json({ results: [] });
    return;
  }

  const users = db
    .prepare(
      `SELECT id, username, display_name, avatar_media_id, bio, mood_today, created_at
       FROM users
       WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?)
       LIMIT 15`
    )
    .all(userId, `%${q}%`, `%${q}%`) as AuthUser[];

  const results = users
    .filter((u) => !isBlockedBetween(userId, u.id))
    .map((u) => {
      const rel = db
        .prepare(
          `SELECT status, requester_id FROM friendships
           WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
        )
        .get(userId, u.id, u.id, userId) as { status: string; requester_id: string } | undefined;
      return {
        ...formatUserPublic(u, userId),
        relation: rel ? (rel.status === 'pending' && rel.requester_id === userId ? 'outgoing' : rel.status) : 'none',
      };
    });

  res.json({ results });
});

app.post('/api/people/request', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const targetUserId = String(req.body?.targetUserId || '');
  if (!targetUserId || targetUserId === userId) {
    res.status(400).json({ error: 'Invalid user.' });
    return;
  }
  const target = db.prepare(`SELECT id, username, notify_friends FROM users WHERE id = ?`).get(targetUserId) as
    | { id: string; username: string; notify_friends: number }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (isBlockedBetween(userId, targetUserId)) {
    res.status(403).json({ error: 'Cannot send a request to this user.' });
    return;
  }

  const existing = db
    .prepare(
      `SELECT id, status FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
    )
    .get(userId, targetUserId, targetUserId, userId) as { id: string; status: string } | undefined;

  if (existing) {
    res.status(409).json({ error: `Relationship already exists (${existing.status}).` });
    return;
  }

  const id = crypto.randomUUID();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`
  ).run(id, userId, targetUserId, ts, ts);

  if (target.notify_friends) {
    createNotification(
      targetUserId,
      'friend_request',
      'New Friend Request',
      `@${req.authUser!.username} wants to connect with you on dear, me.`,
      id
    );
  }

  res.status(201).json({ id });
});

app.post('/api/people/respond', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const friendshipId = String(req.body?.friendshipId || '');
  const action = req.body?.action === 'accept' ? 'accept' : 'decline';

  const row = db
    .prepare(`SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'`)
    .get(friendshipId, userId) as { id: string; requester_id: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Friend request not found.' });
    return;
  }

  if (action === 'accept') {
    db.prepare(`UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?`).run(nowIso(), friendshipId);
    createNotification(
      row.requester_id,
      'friend_accept',
      'Friend Request Accepted',
      `@${req.authUser!.username} accepted your friend request!`,
      friendshipId
    );
  } else {
    db.prepare(`DELETE FROM friendships WHERE id = ?`).run(friendshipId);
  }

  res.json({ ok: true });
});

app.post('/api/people/block', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const targetUserId = String(req.body?.targetUserId || '');
  if (!targetUserId || targetUserId === userId) {
    res.status(400).json({ error: 'Invalid user.' });
    return;
  }

  db.prepare(
    `DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
  ).run(userId, targetUserId, targetUserId, userId);

  const ts = nowIso();
  db.prepare(
    `INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at)
     VALUES (?, ?, ?, 'blocked', ?, ?)`
  ).run(crypto.randomUUID(), userId, targetUserId, ts, ts);

  res.json({ ok: true });
});

app.delete('/api/people/:friendshipId', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const result = db
    .prepare(`DELETE FROM friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?)`)
    .run(req.params.friendshipId, userId, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Connection not found.' });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/people/:friendId/profile', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const friendId = req.params.friendId;

  if (!areFriends(userId, friendId)) {
    res.status(403).json({ error: 'You must be friends to view this profile and shared moments.' });
    return;
  }

  const friend = db.prepare(`SELECT * FROM users WHERE id = ?`).get(friendId) as AuthUser | undefined;
  if (!friend) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // Strictly return ONLY posts explicitly marked visibility = 'friends'
  const sharedPosts = db
    .prepare(`SELECT * FROM posts WHERE user_id = ? AND visibility = 'friends' ORDER BY memory_date DESC, created_at DESC LIMIT 20`)
    .all(friendId) as Array<Record<string, unknown>>;

  const posts = sharedPosts.map((p) => {
    const mediaRows = db
      .prepare(
        `SELECT m.* FROM post_media pm JOIN media_items m ON m.id = pm.media_id WHERE pm.post_id = ? ORDER BY pm.sort_order ASC`
      )
      .all(p.id) as Array<{ id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }>;
    return {
      id: p.id,
      title: p.title,
      caption: p.caption,
      mood: p.mood,
      postType: p.post_type,
      memoryDate: p.memory_date,
      createdAt: p.created_at,
      media: mediaRows.map((m) => buildMediaPayload(m, userId)),
    };
  });

  res.json({
    profile: formatUserPublic(friend, userId),
    sharedMoments: posts,
  });
});

// ================= MESSAGING (DM & GROUP CHAT, REALTIME) =================

app.get('/api/conversations', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const convRows = db
    .prepare(
      `SELECT c.*, cm.last_read_at
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       WHERE cm.user_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(userId) as Array<{ id: string; is_group: number; name: string; created_by: string; updated_at: string; last_read_at: string }>;

  const conversations = convRows.map((c) => {
    const members = db
      .prepare(
        `SELECT u.* FROM conversation_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ?`
      )
      .all(c.id) as AuthUser[];

    const lastMsg = db
      .prepare(
        `SELECT m.*, u.username AS sender_username FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ? ORDER BY m.created_at DESC LIMIT 1`
      )
      .get(c.id) as { id: string; body: string; media_id: string; sender_username: string; created_at: string } | undefined;

    const unreadRow = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM messages
         WHERE conversation_id = ? AND sender_id != ? AND (? = '' OR created_at > ?)`
      )
      .get(c.id, userId, c.last_read_at, c.last_read_at) as { cnt: number };

    const otherMembers = members.filter((m) => m.id !== userId);
    const title = c.is_group
      ? c.name || otherMembers.map((m) => m.display_name).join(', ')
      : otherMembers[0]?.display_name || 'Personal Chat';

    return {
      id: c.id,
      isGroup: Boolean(c.is_group),
      title,
      members: members.map((m) => formatUserPublic(m, userId)),
      lastMessage: lastMsg
        ? {
            body: lastMsg.body || (lastMsg.media_id ? 'Sent an attachment' : ''),
            senderUsername: lastMsg.sender_username,
            createdAt: lastMsg.created_at,
          }
        : null,
      unreadCount: unreadRow.cnt,
      updatedAt: c.updated_at,
    };
  });

  res.json({ conversations });
});

app.post('/api/conversations', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const memberIdsRaw: string[] = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : [];
  const uniqueOthers = [...new Set(memberIdsRaw.filter((id) => id && id !== userId))];
  const isGroup = Boolean(req.body?.isGroup) || uniqueOthers.length > 1;
  const name = String(req.body?.name || '').trim().slice(0, 60);

  if (uniqueOthers.length === 0) {
    res.status(400).json({ error: 'Select at least one friend to start chatting.' });
    return;
  }

  for (const otherId of uniqueOthers) {
    if (!areFriends(userId, otherId) || isBlockedBetween(userId, otherId)) {
      res.status(403).json({ error: 'You can only message accepted friends who are not blocked.' });
      return;
    }
  }

  // If 1-on-1 DM, reuse existing DM conversation if one exists
  if (!isGroup && uniqueOthers.length === 1) {
    const otherId = uniqueOthers[0];
    const existing = db
      .prepare(
        `SELECT c.id FROM conversations c
         JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = ?
         JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = ?
         WHERE c.is_group = 0`
      )
      .get(userId, otherId) as { id: string } | undefined;
    if (existing) {
      res.json({ id: existing.id, existing: true });
      return;
    }
  }

  const convId = crypto.randomUUID();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO conversations (id, is_group, name, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(convId, isGroup ? 1 : 0, isGroup ? name || 'Pink Squad Chat' : '', userId, ts, ts);

  const insertMember = db.prepare(
    `INSERT INTO conversation_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, ?)`
  );
  insertMember.run(convId, userId, ts, ts);
  for (const otherId of uniqueOthers) {
    insertMember.run(convId, otherId, ts, '');
  }

  res.status(201).json({ id: convId, existing: false });
});

app.get('/api/conversations/:id/messages', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const convId = req.params.id;
  const member = db
    .prepare(`SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?`)
    .get(convId, userId);
  if (!member) {
    res.status(403).json({ error: 'You are not a member of this conversation.' });
    return;
  }

  const msgRows = db
    .prepare(
      `SELECT m.*, u.username AS sender_username, u.display_name AS sender_display_name, u.avatar_media_id AS sender_avatar_id
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`
    )
    .all(convId) as Array<Record<string, unknown>>;

  const memberReadRows = db
    .prepare(`SELECT user_id, last_read_at FROM conversation_members WHERE conversation_id = ? AND user_id != ?`)
    .all(convId, userId) as Array<{ user_id: string; last_read_at: string }>;

  const messages = msgRows.map((m) => {
    let media: ReturnType<typeof buildMediaPayload> | null = null;
    if (m.media_id) {
      const mRow = db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(m.media_id) as
        | { id: string; mime_type: string; media_kind: string; original_name: string; size_bytes: number }
        | undefined;
      if (mRow) media = buildMediaPayload(mRow, userId);
    }

    const reactions = db
      .prepare(`SELECT emoji, user_id FROM message_reactions WHERE message_id = ?`)
      .all(m.id) as Array<{ emoji: string; user_id: string }>;

    const readByOthers = memberReadRows.some((mr) => mr.last_read_at && mr.last_read_at >= String(m.created_at));

    return {
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderUsername: m.sender_username,
      senderDisplayName: m.sender_display_name,
      senderAvatarUrl: m.sender_avatar_id
        ? `/api/media/${m.sender_avatar_id}?mt=${createMediaToken(String(m.sender_avatar_id), userId)}`
        : '',
      body: m.body,
      media,
      reactions,
      readByOthers,
      createdAt: m.created_at,
    };
  });

  // Mark as read for current user
  const ts = nowIso();
  db.prepare(`UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`).run(
    ts,
    convId,
    userId
  );

  const memberIds = memberReadRows.map((r) => r.user_id);
  pushWsToUsers(memberIds, { type: 'read', conversationId: convId, userId, readAt: ts });

  res.json({ messages });
});

app.post('/api/conversations/:id/messages', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const convId = req.params.id;
  const member = db
    .prepare(`SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?`)
    .get(convId, userId);
  if (!member) {
    res.status(403).json({ error: 'You are not a member of this conversation.' });
    return;
  }

  const body = String(req.body?.body || '').trim().slice(0, 4000);
  const mediaId = String(req.body?.mediaId || '');

  if (!body && !mediaId) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }

  let validMediaId = '';
  if (mediaId) {
    const owned = db.prepare(`SELECT id FROM media_items WHERE id = ? AND user_id = ?`).get(mediaId, userId);
    if (owned) {
      validMediaId = mediaId;
      db.prepare(`UPDATE media_items SET owner_scope = 'message', scope_id = ? WHERE id = ?`).run(convId, validMediaId);
    }
  }

  const msgId = crypto.randomUUID();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, body, media_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(msgId, convId, userId, body, validMediaId, ts);

  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(ts, convId);
  db.prepare(`UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`).run(
    ts,
    convId,
    userId
  );

  const members = db
    .prepare(`SELECT user_id FROM conversation_members WHERE conversation_id = ?`)
    .all(convId) as Array<{ user_id: string }>;

  const mRow = validMediaId
    ? (db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(validMediaId) as {
        id: string;
        mime_type: string;
        media_kind: string;
        original_name: string;
        size_bytes: number;
      })
    : null;

  for (const m of members) {
    const payload = {
      type: 'message:new',
      conversationId: convId,
      message: {
        id: msgId,
        conversationId: convId,
        senderId: userId,
        senderUsername: req.authUser!.username,
        senderDisplayName: req.authUser!.display_name,
        senderAvatarUrl: req.authUser!.avatar_media_id
          ? `/api/media/${req.authUser!.avatar_media_id}?mt=${createMediaToken(req.authUser!.avatar_media_id, m.user_id)}`
          : '',
        body,
        media: mRow ? buildMediaPayload(mRow, m.user_id) : null,
        reactions: [],
        readByOthers: false,
        createdAt: ts,
      },
    };
    pushWsToUsers([m.user_id], payload);

    if (m.user_id !== userId) {
      const recipientPref = db.prepare(`SELECT notify_messages FROM users WHERE id = ?`).get(m.user_id) as
        | { notify_messages: number }
        | undefined;
      if (recipientPref?.notify_messages) {
        createNotification(
          m.user_id,
          'message',
          `@${req.authUser!.username}`,
          body || 'Sent a photo/video/voice attachment',
          convId
        );
      }
    }
  }

  res.status(201).json({ id: msgId });
});

app.post('/api/messages/:id/react', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const messageId = req.params.id;
  const emoji = String(req.body?.emoji || '♥').slice(0, 8);

  const msg = db
    .prepare(
      `SELECT m.conversation_id FROM messages m
       JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
       WHERE m.id = ? AND cm.user_id = ?`
    )
    .get(messageId, userId) as { conversation_id: string } | undefined;

  if (!msg) {
    res.status(403).json({ error: 'Message not accessible.' });
    return;
  }

  const existing = db
    .prepare(`SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`)
    .get(messageId, userId, emoji) as { id: string } | undefined;

  if (existing) {
    db.prepare(`DELETE FROM message_reactions WHERE id = ?`).run(existing.id);
  } else {
    db.prepare(`INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(),
      messageId,
      userId,
      emoji,
      nowIso()
    );
  }

  const reactions = db
    .prepare(`SELECT emoji, user_id FROM message_reactions WHERE message_id = ?`)
    .all(messageId) as Array<{ emoji: string; user_id: string }>;

  const members = db
    .prepare(`SELECT user_id FROM conversation_members WHERE conversation_id = ?`)
    .all(msg.conversation_id) as Array<{ user_id: string }>;
  pushWsToUsers(
    members.map((m) => m.user_id),
    { type: 'message:reaction', conversationId: msg.conversation_id, messageId, reactions }
  );

  res.json({ reactions });
});

// ================= NOTIFICATIONS =================

app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.authUser!.id);
  res.json({ ok: true });
});

// ================= SETTINGS & SESSIONS =================

app.patch('/api/settings/profile', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const displayName = String(req.body?.displayName || req.authUser!.display_name).trim().slice(0, 40);
  const bio = String(req.body?.bio ?? req.authUser!.bio).trim().slice(0, 240);
  const wallpaperId = ['gingham', 'pearl-satin', 'pixel-phone', 'starry-blush'].includes(req.body?.wallpaperId)
    ? req.body.wallpaperId
    : req.authUser!.wallpaper_id;
  const privacyDefault = req.body?.privacyDefault === 'friends' ? 'friends' : 'private';
  const notifyMessages = req.body?.notifyMessages === undefined ? req.authUser!.notify_messages : req.body.notifyMessages ? 1 : 0;
  const notifyFriends = req.body?.notifyFriends === undefined ? req.authUser!.notify_friends : req.body.notifyFriends ? 1 : 0;
  const notifyCapsules = req.body?.notifyCapsules === undefined ? req.authUser!.notify_capsules : req.body.notifyCapsules ? 1 : 0;

  let avatarMediaId = req.authUser!.avatar_media_id;
  if (req.body?.avatarMediaId) {
    const owned = db
      .prepare(`SELECT id FROM media_items WHERE id = ? AND user_id = ?`)
      .get(String(req.body.avatarMediaId), userId);
    if (owned) {
      avatarMediaId = String(req.body.avatarMediaId);
      db.prepare(`UPDATE media_items SET owner_scope = 'avatar' WHERE id = ?`).run(avatarMediaId);
    }
  }

  db.prepare(
    `UPDATE users SET display_name = ?, bio = ?, wallpaper_id = ?, privacy_default = ?,
     notify_messages = ?, notify_friends = ?, notify_capsules = ?, avatar_media_id = ?
     WHERE id = ?`
  ).run(displayName, bio, wallpaperId, privacyDefault, notifyMessages, notifyFriends, notifyCapsules, avatarMediaId, userId);

  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as AuthUser;
  res.json({ user: formatUserSelf(updated) });
});

app.post('/api/settings/password', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 6 || newPassword.length > 128) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }

  const row = db.prepare(`SELECT password_hash, password_salt FROM users WHERE id = ?`).get(userId) as {
    password_hash: string;
    password_salt: string;
  };
  if (!verifySecret(currentPassword, row.password_hash, row.password_salt)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const pwd = hashSecret(newPassword);
  db.prepare(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`).run(pwd.hash, pwd.salt, userId);
  res.json({ ok: true });
});

app.post('/api/settings/pin', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const enabled = Boolean(req.body?.enabled);
  const pin = String(req.body?.pin || '').trim();

  if (!enabled) {
    db.prepare(`UPDATE users SET pin_enabled = 0, pin_hash = '', pin_salt = '' WHERE id = ?`).run(userId);
    res.json({ pinEnabled: false });
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
    return;
  }

  const pinData = hashSecret(pin);
  db.prepare(`UPDATE users SET pin_enabled = 1, pin_hash = ?, pin_salt = ? WHERE id = ?`).run(
    pinData.hash,
    pinData.salt,
    userId
  );
  res.json({ pinEnabled: true });
});

app.get('/api/settings/sessions', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const rows = db
    .prepare(
      `SELECT id, device_label, created_at, last_active_at, is_revoked
       FROM sessions WHERE user_id = ? AND is_revoked = 0 ORDER BY last_active_at DESC`
    )
    .all(userId) as Array<Record<string, unknown>>;

  res.json({
    sessions: rows.map((s) => ({
      id: s.id,
      deviceLabel: s.device_label,
      createdAt: s.created_at,
      lastActiveAt: s.last_active_at,
      isCurrent: s.id === req.sessionId,
    })),
  });
});

app.delete('/api/settings/sessions/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.authUser!.id;
  const result = db
    .prepare(`UPDATE sessions SET is_revoked = 1 WHERE id = ? AND user_id = ?`)
    .run(req.params.id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  res.json({ ok: true, revokedCurrent: req.params.id === req.sessionId });
});

// Error handler for multer & unexpected errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Unexpected server error.' });
});

// ================= SERVER + WEBSOCKET + VITE =================

async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let authedUserId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data?.type === 'auth' && typeof data.token === 'string') {
          const authRes = authenticateBearer(data.token);
          if (authRes) {
            authedUserId = authRes.user.id;
            if (!wsClients.has(authedUserId)) wsClients.set(authedUserId, new Set());
            wsClients.get(authedUserId)!.add(ws);
            ws.send(JSON.stringify({ type: 'auth:ok' }));
          }
          return;
        }
        if (!authedUserId) return;

        if (data?.type === 'typing' && typeof data.conversationId === 'string') {
          const isMember = db
            .prepare(`SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?`)
            .get(data.conversationId, authedUserId);
          if (!isMember) return;
          const members = db
            .prepare(`SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?`)
            .all(data.conversationId, authedUserId) as Array<{ user_id: string }>;
          pushWsToUsers(
            members.map((m) => m.user_id),
            {
              type: 'typing',
              conversationId: data.conversationId,
              userId: authedUserId,
              isTyping: Boolean(data.isTyping),
            }
          );
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      if (authedUserId && wsClients.has(authedUserId)) {
        wsClients.get(authedUserId)!.delete(ws);
        if (wsClients.get(authedUserId)!.size === 0) {
          wsClients.delete(authedUserId);
        }
      }
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(path.join(distDir, 'index.html'))) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`dear, me. server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
