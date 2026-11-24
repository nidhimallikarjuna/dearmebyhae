import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Delete,
  Heart,
  KeyRound,
  Lock,
  Sparkles,
  Unlock,
  UserPlus,
} from 'lucide-react';
import { apiFetch, getLockUiPref, saveLockUiPref, setSessionToken } from '../api';
import type { UserSelf, WallpaperId } from '../types';
import { AvatarCircle, ChromeButton, GlossyButton } from './RetroUI';

const WALLPAPER_IMG = '/src/assets/images/y2k_pink_wallpaper_1795533101807.jpg';
const FLIP_PHONE_IMG = '/src/assets/images/y2k_flip_phone_1795533103531.jpg';

export function getWallpaperStyle(wallpaperId: WallpaperId): React.CSSProperties {
  if (wallpaperId === 'gingham') {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(255,240,245,0.45), rgba(248,216,230,0.6)), url(${WALLPAPER_IMG})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  if (wallpaperId === 'pearl-satin') {
    return {
      background:
        'radial-gradient(circle at 20% 20%, #FFFFFF 0%, #FFF0F5 35%, #FFB6D5 78%, #FF69AD 100%)',
    };
  }
  if (wallpaperId === 'pixel-phone') {
    return {
      backgroundColor: '#FCE2EE',
      backgroundImage:
        'repeating-linear-gradient(90deg, #FFF0F5 0px, #FFF0F5 20px, #F8D8E6 20px, #F8D8E6 40px), radial-gradient(circle at 50% 15%, rgba(242,11,131,0.22), transparent 60%)',
    };
  }
  return {
    background:
      'linear-gradient(160deg, #FFF0F5 0%, #F8D8E6 45%, #FFB6D5 85%, #FF69AD 100%)',
  };
}

interface LockPreview {
  found: boolean;
  username?: string;
  displayName?: string;
  pinEnabled?: boolean;
  wallpaperId?: WallpaperId;
  avatarUrl?: string;
}

export function LockScreen({
  onUnlock,
  initialMode = 'login',
}: {
  onUnlock: (user: UserSelf) => void;
  initialMode?: 'login' | 'pin' | 'register' | 'forgot';
}) {
  const pref = getLockUiPref();
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<'login' | 'pin' | 'register' | 'forgot'>(initialMode);
  const [wallpaperId, setWallpaperId] = useState<WallpaperId>(pref.wallpaperId);

  const [username, setUsername] = useState(pref.lastUsername);
  const [password, setPassword] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [regPin, setRegPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [preview, setPreview] = useState<LockPreview>({ found: false });
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // One-time recovery code modal after registration or password reset
  const [pendingUser, setPendingUser] = useState<UserSelf | null>(null);
  const [issuedRecoveryCode, setIssuedRecoveryCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (clean.length < 3) {
      setPreview({ found: false });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<LockPreview>(`/api/auth/lock-preview?username=${encodeURIComponent(clean)}`);
        setPreview(res);
        if (res.found && res.wallpaperId) {
          setWallpaperId(res.wallpaperId);
          saveLockUiPref({ wallpaperId: res.wallpaperId });
        }
      } catch {
        // ignore preview fetch error
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [username]);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const completeUnlock = (user: UserSelf) => {
    saveLockUiPref({ lastUsername: user.username, wallpaperId: user.wallpaperId });
    setUnlocking(true);
    setTimeout(() => {
      onUnlock(user);
    }, 320);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserSelf }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setSessionToken(res.token);
      completeUnlock(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to unlock.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (pinValue: string) => {
    if (pinValue.length !== 4) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserSelf }>('/api/auth/unlock-pin', {
        method: 'POST',
        body: JSON.stringify({ username, pin: pinValue }),
      });
      setSessionToken(res.token);
      completeUnlock(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect PIN.');
      setPinInput('');
    } finally {
      setLoading(false);
    }
  };

  const tapPinDigit = (digit: string) => {
    if (loading || pinInput.length >= 4) return;
    const next = `${pinInput}${digit}`;
    setPinInput(next);
    if (next.length === 4) {
      void handlePinSubmit(next);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: UserSelf; recoveryCode: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          displayName,
          email,
          password,
          pin: regPin,
        }),
      });
      setSessionToken(res.token);
      saveLockUiPref({ lastUsername: res.user.username, wallpaperId: res.user.wallpaperId });
      setIssuedRecoveryCode(res.recoveryCode);
      setPendingUser(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; newRecoveryCode: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          username,
          email,
          recoveryCode,
          newPassword,
        }),
      });
      setInfoMsg(`Password updated! Your new recovery code is: ${res.newRecoveryCode}`);
      setMode('login');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={getWallpaperStyle(wallpaperId)}
      className={`min-h-screen w-full relative overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
        unlocking ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Soft blur & sparkle overlay */}
      <div className="pointer-events-none fixed inset-0 backdrop-blur-[2px] bg-[#FFF0F5]/20" />
      <div className="pointer-events-none fixed top-8 left-10 text-[#F20B83]/50 animate-twinkle hidden sm:block">
        <Sparkles className="w-7 h-7" />
      </div>
      <div className="pointer-events-none fixed bottom-10 right-12 text-[#FF69AD]/60 animate-twinkle hidden sm:block">
        <Heart className="w-7 h-7 fill-[#FFB6D5]" />
      </div>

      {/* Main iPhone + Y2K Phone Lock Card */}
      <div className="relative z-10 w-full max-w-[440px]">
        {/* Top Phone Status Strip */}
        <div className="flex items-center justify-between px-4 py-1.5 mb-2 rounded-full bg-white/80 backdrop-blur-md border border-[#FFB6D5] shadow-sm">
          <span className="font-['VT323'] text-lg text-[#F20B83] tracking-wider">DEAR,ME 4G ♥</span>
          <div className="flex items-center gap-2 font-['VT323'] text-base text-[#7D1B4D]">
            <span>{dateStr.split(',')[0].toUpperCase()}</span>
            <span className="inline-block w-5 h-2.5 border border-[#F20B83] rounded-[2px] p-[1px]">
              <span className="block h-full w-4/5 bg-[#FF69AD]" />
            </span>
          </div>
        </div>

        <div className="pearl-frame rounded-[30px] overflow-hidden bg-white/88 backdrop-blur-md">
          {/* Glossy Top Lock Header */}
          <div className="glossy-pink-bar px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <div className="w-7 h-7 rounded-full bg-white/25 border border-white/60 flex items-center justify-center">
                {unlocking ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <span className="font-['Pixelify_Sans'] text-sm tracking-wide">dear, me. diary lock</span>
            </div>
            <div className="flex items-center gap-1.5">
              {(['gingham', 'pearl-satin', 'pixel-phone', 'starry-blush'] as WallpaperId[]).map((wp) => (
                <button
                  key={wp}
                  type="button"
                  title={`Wallpaper: ${wp}`}
                  onClick={() => {
                    setWallpaperId(wp);
                    saveLockUiPref({ wallpaperId: wp });
                  }}
                  className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
                    wallpaperId === wp ? 'border-white scale-110 ring-2 ring-white/60' : 'border-white/60 opacity-75'
                  }`}
                  style={{
                    background:
                      wp === 'gingham'
                        ? '#FFB6D5'
                        : wp === 'pearl-satin'
                          ? '#FFFFFF'
                          : wp === 'pixel-phone'
                            ? '#F20B83'
                            : '#FF69AD',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {/* Digital Clock & Date */}
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 mb-1">
                <img
                  src={FLIP_PHONE_IMG}
                  alt="Pink flip phone"
                  className="w-9 h-9 rounded-full object-cover border-2 border-[#FFB6D5] shadow-sm"
                />
                <span className="font-['Pixelify_Sans'] text-xs text-[#C76B94] uppercase tracking-widest">
                  {dateStr}
                </span>
              </div>
              <div className="font-['VT323'] text-6xl sm:text-7xl text-[#F20B83] leading-none tracking-wider tabular-nums drop-shadow-[0_2px_0_#FFB6D5]">
                {timeStr}
              </div>
            </div>

            {pendingUser && issuedRecoveryCode ? (
              <div className="retro-dotted-box rounded-2xl p-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#FFF0F5] border-2 border-[#FF69AD] mx-auto flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-[#F20B83]" />
                </div>
                <h2 className="font-['Pixelify_Sans'] text-lg font-bold text-[#F20B83]">
                  Save Your Recovery Code
                </h2>
                <p className="text-xs text-[#7D1B4D]">
                  Keep this code safe in case you ever forget your password:
                </p>
                <div className="bg-[#FFF0F5] border-2 border-[#FF69AD] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                  <code className="font-['VT323'] text-2xl text-[#F20B83] tracking-wider">{issuedRecoveryCode}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(issuedRecoveryCode);
                      setCopiedCode(true);
                    }}
                    className="chrome-btn rounded-lg px-2.5 py-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <GlossyButton className="w-full" onClick={() => completeUnlock(pendingUser)}>
                  <Unlock className="w-4 h-4" /> Enter My Diary
                </GlossyButton>
              </div>
            ) : (
              <>
                {/* User Preview Badge if found */}
                {preview.found && (mode === 'login' || mode === 'pin') && (
                  <div className="flex items-center gap-3 bg-[#FFF0F5] border border-[#FFB6D5] rounded-2xl px-3.5 py-2.5 mb-4">
                    <AvatarCircle url={preview.avatarUrl} name={preview.displayName || username} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">
                        {preview.displayName}
                      </p>
                      <p className="font-['VT323'] text-base text-[#C76B94] leading-none">@{preview.username}</p>
                    </div>
                    {preview.pinEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setPinInput('');
                          setMode(mode === 'pin' ? 'login' : 'pin');
                        }}
                        className="chrome-btn rounded-full px-3 py-1 text-[11px] cursor-pointer"
                      >
                        {mode === 'pin' ? 'Use Password' : 'Use PIN'}
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="mb-3 rounded-xl bg-[#FFE3EF] border border-[#F20B83] px-3 py-2 text-xs text-[#A30554] font-medium">
                    {error}
                  </div>
                )}
                {infoMsg && (
                  <div className="mb-3 rounded-xl bg-[#FFF0F5] border border-[#FF69AD] px-3 py-2 text-xs text-[#7D1B4D] font-medium">
                    {infoMsg}
                  </div>
                )}

                {mode === 'login' && (
                  <form onSubmit={handlePasswordLogin} className="space-y-3">
                    <div>
                      <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Username</label>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. strawberry_rei"
                        className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3.5 py-2.5 text-sm text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                      />
                    </div>
                    <div>
                      <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Password</label>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3.5 py-2.5 text-sm text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                      />
                    </div>
                    <GlossyButton type="submit" disabled={loading} className="w-full py-2.5 text-sm">
                      <Unlock className="w-4 h-4" />
                      {loading ? 'Unlocking...' : 'Unlock dear, me.'}
                    </GlossyButton>
                  </form>
                )}

                {mode === 'pin' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username"
                        className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                      />
                    </div>

                    {/* 4-dot PIN display */}
                    <div className="flex items-center justify-center gap-3 py-1">
                      {[0, 1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full border-2 border-[#F20B83] transition-all ${
                            idx < pinInput.length ? 'bg-[#F20B83] scale-110' : 'bg-[#FFF0F5]'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Glossy Y2K PIN Keypad */}
                    <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => tapPinDigit(digit)}
                          className="chrome-btn h-12 rounded-2xl font-['VT323'] text-2xl font-bold text-[#F20B83] cursor-pointer"
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPinInput('')}
                        className="chrome-btn h-12 rounded-2xl font-['Pixelify_Sans'] text-xs text-[#7D1B4D] cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => tapPinDigit('0')}
                        className="chrome-btn h-12 rounded-2xl font-['VT323'] text-2xl font-bold text-[#F20B83] cursor-pointer"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => setPinInput((p) => p.slice(0, -1))}
                        aria-label="Backspace"
                        className="chrome-btn h-12 rounded-2xl flex items-center justify-center text-[#7D1B4D] cursor-pointer"
                      >
                        <Delete className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Username</label>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="bunny_2005"
                          className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                        />
                      </div>
                      <div>
                        <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Display Name</label>
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Lily"
                          className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Password</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="6+ chars"
                          className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                        />
                      </div>
                      <div>
                        <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">
                          PIN (optional)
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={regPin}
                          onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="4 digits"
                          className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                        />
                      </div>
                    </div>
                    <GlossyButton type="submit" disabled={loading} className="w-full py-2.5 text-sm mt-1">
                      <UserPlus className="w-4 h-4" />
                      {loading ? 'Creating Diary...' : 'Create My Diary'}
                    </GlossyButton>
                  </form>
                )}

                {mode === 'forgot' && (
                  <form onSubmit={handleResetPassword} className="space-y-2.5">
                    <div>
                      <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Username</label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                      />
                    </div>
                    <div>
                      <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                      />
                    </div>
                    <div>
                      <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">
                        Recovery Code
                      </label>
                      <input
                        type="text"
                        required
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                        placeholder="PINK-XXXXXX-XXXX"
                        className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                      />
                    </div>
                    <div>
                      <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">New Password</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                      />
                    </div>
                    <GlossyButton type="submit" disabled={loading} className="w-full py-2.5 text-sm">
                      <KeyRound className="w-4 h-4" />
                      {loading ? 'Resetting...' : 'Reset Password'}
                    </GlossyButton>
                  </form>
                )}

                {/* Mode Switch Links */}
                <div className="mt-4 pt-3 border-t border-dashed border-[#FFB6D5] flex flex-wrap items-center justify-between gap-2 text-xs">
                  {mode !== 'register' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMode('register');
                      }}
                      className="font-['Pixelify_Sans'] text-[#F20B83] hover:underline cursor-pointer"
                    >
                      New here? Create account
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMode('login');
                      }}
                      className="font-['Pixelify_Sans'] text-[#F20B83] hover:underline cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  )}

                  {mode !== 'forgot' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMode('forgot');
                      }}
                      className="font-['Pixelify_Sans'] text-[#C76B94] hover:text-[#F20B83] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMode('login');
                      }}
                      className="font-['Pixelify_Sans'] text-[#C76B94] hover:text-[#F20B83] hover:underline cursor-pointer"
                    >
                      Back to Login
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
