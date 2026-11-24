import type { MediaItem, WallpaperId } from './types';

// Keep active auth session token strictly in memory so reopening/reloading locks the diary
let inMemoryToken = '';

export function setSessionToken(token: string) {
  inMemoryToken = token;
}

export function getSessionToken(): string {
  return inMemoryToken;
}

// Non-secret UI convenience preferences (no tokens or credentials stored in localStorage)
const PREF_KEY = 'dearme_lock_ui_pref';

interface LockUiPref {
  lastUsername: string;
  wallpaperId: WallpaperId;
}

export function getLockUiPref(): LockUiPref {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { lastUsername: '', wallpaperId: 'gingham' };
    const parsed = JSON.parse(raw);
    return {
      lastUsername: typeof parsed.lastUsername === 'string' ? parsed.lastUsername : '',
      wallpaperId: ['gingham', 'pearl-satin', 'pixel-phone', 'starry-blush'].includes(parsed.wallpaperId)
        ? parsed.wallpaperId
        : 'gingham',
    };
  } catch {
    return { lastUsername: '', wallpaperId: 'gingham' };
  }
}

export function saveLockUiPref(pref: Partial<LockUiPref>) {
  const current = getLockUiPref();
  const next = { ...current, ...pref };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Backend base URL. Empty = same origin (local dev). On Vercel set VITE_API_URL
// to your backend URL, e.g. https://dear-me-api.up.railway.app (no trailing slash).
export const API_BASE: string = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return path.startsWith('/') ? `${API_BASE}${path}` : path;
}

export function wsUrl(path = '/ws'): string {
  if (API_BASE) return API_BASE.replace(/^http/, 'ws') + path;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}

export async function apiFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(apiUrl(url), { ...options, headers });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    throw new ApiError(String(data.error || `Request failed (${res.status})`), res.status);
  }
  return data as T;
}

export async function apiUpload(files: File[], scope: string, scopeId = ''): Promise<MediaItem[]> {
  const formData = new FormData();
  formData.append('scope', scope);
  if (scopeId) formData.append('scopeId', scopeId);
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await apiFetch<{ media: MediaItem[] }>('/api/media/upload', {
    method: 'POST',
    body: formData,
  });
  return res.media;
}
