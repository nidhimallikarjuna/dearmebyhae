import React, { useEffect, useState } from 'react';
import {
  Bell,
  KeyRound,
  Lock,
  MonitorSmartphone,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { apiFetch, apiUpload, saveLockUiPref } from '../api';
import type { SessionInfo, UserPublic, UserSelf, WallpaperId } from '../types';
import {
  AvatarCircle,
  ChromeButton,
  GlossyButton,
  PearlPanel,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

type SettingsTab = 'account' | 'security' | 'wallpaper' | 'notifications' | 'people' | 'sessions';

export function SettingsPanel({
  user,
  onUserUpdated,
  onSessionRevoked,
}: {
  user: UserSelf;
  onUserUpdated: (user: UserSelf) => void;
  onSessionRevoked: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>('account');

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [privacyDefault, setPrivacyDefault] = useState<'private' | 'friends'>(user.privacyDefault);
  const [wallpaperId, setWallpaperId] = useState<WallpaperId>(user.wallpaperId);
  const [notifyMessages, setNotifyMessages] = useState(user.notifyMessages);
  const [notifyFriends, setNotifyFriends] = useState(user.notifyFriends);
  const [notifyCapsules, setNotifyCapsules] = useState(user.notifyCapsules);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pinEnabled, setPinEnabled] = useState(user.pinEnabled);
  const [newPin, setNewPin] = useState('');

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [friends, setFriends] = useState<UserPublic[]>([]);
  const [blocked, setBlocked] = useState<UserPublic[]>([]);

  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadPeopleAndSessions = async () => {
    const [sessRes, pplRes] = await Promise.all([
      apiFetch<{ sessions: SessionInfo[] }>('/api/settings/sessions'),
      apiFetch<{ friends: UserPublic[]; blocked: UserPublic[] }>('/api/people'),
    ]);
    setSessions(sessRes.sessions);
    setFriends(pplRes.friends);
    setBlocked(pplRes.blocked);
  };

  useEffect(() => {
    void loadPeopleAndSessions();
  }, []);

  const saveProfileSettings = async (overrides: Record<string, unknown> = {}) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiFetch<{ user: UserSelf }>('/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName,
          bio,
          privacyDefault,
          wallpaperId,
          notifyMessages,
          notifyFriends,
          notifyCapsules,
          ...overrides,
        }),
      });
      saveLockUiPref({ wallpaperId: res.user.wallpaperId });
      onUserUpdated(res.user);
      setStatusMsg('Settings saved!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save settings.');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploaded = await apiUpload([file], 'avatar');
    await saveProfileSettings({ avatarMediaId: uploaded[0].id });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch('/api/settings/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setStatusMsg('Password updated!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update password.');
    }
  };

  const handlePinSave = async (enable: boolean) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiFetch<{ pinEnabled: boolean }>('/api/settings/pin', {
        method: 'POST',
        body: JSON.stringify({ enabled: enable, pin: newPin }),
      });
      setPinEnabled(res.pinEnabled);
      setNewPin('');
      onUserUpdated({ ...user, pinEnabled: res.pinEnabled });
      setStatusMsg(res.pinEnabled ? '4-digit Lock PIN enabled!' : 'Lock PIN disabled.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update PIN.');
    }
  };

  const revokeSession = async (id: string) => {
    const res = await apiFetch<{ revokedCurrent: boolean }>(`/api/settings/sessions/${id}`, {
      method: 'DELETE',
    });
    if (res.revokedCurrent) {
      onSessionRevoked();
    } else {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const removeConnection = async (friendshipId: string) => {
    await apiFetch(`/api/people/${friendshipId}`, { method: 'DELETE' });
    await loadPeopleAndSessions();
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'account', label: 'Account & Privacy', icon: User },
    { id: 'security', label: 'Password & PIN', icon: KeyRound },
    { id: 'wallpaper', label: 'Lock Wallpaper', icon: Sparkles },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'people', label: 'Friends & Blocked', icon: Users },
    { id: 'sessions', label: 'Active Sessions', icon: MonitorSmartphone },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag="DIARY CONTROL PANEL"
        title="Settings"
        subtitle="Manage your profile, privacy defaults, lock PIN, pink wallpaper, and active sessions."
      />

      {statusMsg && (
        <div className="rounded-xl bg-[#FFF0F5] border-2 border-[#FF69AD] px-4 py-2 text-xs text-[#F20B83] font-semibold">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-[#FFE3EF] border-2 border-[#F20B83] px-4 py-2 text-xs text-[#A30554] font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Tab Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setStatusMsg('');
                setErrorMsg('');
                setTab(t.id);
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-['Pixelify_Sans'] whitespace-nowrap shrink-0 border flex items-center gap-1.5 cursor-pointer ${
                tab === t.id
                  ? 'glossy-pink-bar text-white border-[#B5055E]'
                  : 'bg-white text-[#7D1B4D] border-[#FFB6D5] hover:border-[#F20B83]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'account' && (
        <PearlPanel title="ACCOUNT & DEFAULT PRIVACY">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <AvatarCircle url={user.avatarUrl} name={user.displayName} size="xl" />
              <div className="space-y-1.5">
                <p className="font-['Pixelify_Sans'] text-sm font-bold text-[#3D1329]">@{user.username}</p>
                <label className="chrome-btn rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Change Avatar
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
              />
            </div>

            <div>
              <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Diary Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
              />
            </div>

            <div>
              <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">
                Default Post Privacy (My Little Life)
              </label>
              <div className="flex gap-2">
                {(['private', 'friends'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPrivacyDefault(mode)}
                    className={`rounded-xl px-4 py-2 text-xs font-['Pixelify_Sans'] border flex items-center gap-1.5 cursor-pointer ${
                      privacyDefault === mode
                        ? 'bg-[#F20B83] text-white border-[#B5055E]'
                        : 'bg-[#FFF0F5] text-[#7D1B4D] border-[#FFB6D5]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {mode === 'private' ? 'Private by Default (Recommended)' : 'Friends by Default'}
                  </button>
                ))}
              </div>
            </div>

            <GlossyButton onClick={() => saveProfileSettings()}>Save Account Settings</GlossyButton>
          </div>
        </PearlPanel>
      )}

      {tab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PearlPanel title="CHANGE PASSWORD">
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
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
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
                />
              </div>
              <GlossyButton type="submit">Update Password</GlossyButton>
            </form>
          </PearlPanel>

          <PearlPanel title="LOCK SCREEN 4-DIGIT PIN">
            <div className="space-y-3">
              <p className="text-xs text-[#7D1B4D]">
                Status:{' '}
                <strong className="text-[#F20B83] font-['Pixelify_Sans']">
                  {pinEnabled ? 'PIN Keypad Enabled' : 'Password Only'}
                </strong>
              </p>
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">
                  Set New 4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <GlossyButton onClick={() => handlePinSave(true)} disabled={newPin.length !== 4}>
                  <Lock className="w-3.5 h-3.5" /> Enable / Update PIN
                </GlossyButton>
                {pinEnabled && (
                  <ChromeButton onClick={() => handlePinSave(false)}>Disable PIN</ChromeButton>
                )}
              </div>
            </div>
          </PearlPanel>
        </div>
      )}

      {tab === 'wallpaper' && (
        <PearlPanel title="LOCK SCREEN WALLPAPER">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {(
              [
                { id: 'gingham', label: 'Pearl Gingham' },
                { id: 'pearl-satin', label: 'Pearl Satin' },
                { id: 'pixel-phone', label: 'Pink Stripes' },
                { id: 'starry-blush', label: 'Starry Blush' },
              ] as Array<{ id: WallpaperId; label: string }>
            ).map((wp) => (
              <button
                key={wp.id}
                type="button"
                onClick={() => {
                  setWallpaperId(wp.id);
                  void saveProfileSettings({ wallpaperId: wp.id });
                }}
                className={`rounded-2xl border-2 p-3 text-center cursor-pointer transition-transform ${
                  wallpaperId === wp.id
                    ? 'border-[#F20B83] bg-[#FFF0F5] scale-[1.02]'
                    : 'border-[#FFB6D5] bg-white'
                }`}
              >
                <div
                  className="h-20 rounded-xl border border-[#FFB6D5] mb-2"
                  style={{
                    background:
                      wp.id === 'gingham'
                        ? '#F8D8E6'
                        : wp.id === 'pearl-satin'
                          ? 'radial-gradient(circle, #FFF, #FF69AD)'
                          : wp.id === 'pixel-phone'
                            ? 'repeating-linear-gradient(90deg, #FFF0F5 0 8px, #FFB6D5 8px 16px)'
                            : 'linear-gradient(135deg, #FFF0F5, #FF69AD)',
                  }}
                />
                <span className="font-['Pixelify_Sans'] text-xs text-[#3D1329]">{wp.label}</span>
              </button>
            ))}
          </div>
        </PearlPanel>
      )}

      {tab === 'notifications' && (
        <PearlPanel title="NOTIFICATION PREFERENCES">
          <div className="space-y-3">
            {[
              {
                label: 'New direct & group messages',
                val: notifyMessages,
                set: setNotifyMessages,
              },
              {
                label: 'Friend requests & acceptances',
                val: notifyFriends,
                set: setNotifyFriends,
              },
              {
                label: 'Time capsule & letter unlock alerts',
                val: notifyCapsules,
                set: setNotifyCapsules,
              },
            ].map((item, idx) => (
              <label
                key={idx}
                className="flex items-center justify-between rounded-xl border border-[#FFB6D5] bg-[#FFF8FB] px-4 py-3 cursor-pointer"
              >
                <span className="font-['Pixelify_Sans'] text-xs sm:text-sm text-[#3D1329]">{item.label}</span>
                <input
                  type="checkbox"
                  checked={item.val}
                  onChange={(e) => item.set(e.target.checked)}
                  className="w-4 h-4 accent-[#F20B83]"
                />
              </label>
            ))}
            <GlossyButton onClick={() => saveProfileSettings()}>Save Preferences</GlossyButton>
          </div>
        </PearlPanel>
      )}

      {tab === 'people' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PearlPanel title={`MANAGE FRIENDS (${friends.length})`}>
            {friends.length === 0 ? (
              <p className="text-xs text-[#C76B94] font-['Pixelify_Sans']">No friends yet.</p>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border border-[#FFB6D5] bg-[#FFF8FB] p-2.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AvatarCircle url={f.avatarUrl} name={f.displayName} size="sm" />
                      <span className="font-['Pixelify_Sans'] text-xs text-[#3D1329] truncate">
                        @{f.username}
                      </span>
                    </div>
                    <ChromeButton onClick={() => f.friendshipId && removeConnection(f.friendshipId)}>
                      Remove
                    </ChromeButton>
                  </div>
                ))}
              </div>
            )}
          </PearlPanel>

          <PearlPanel title={`BLOCKED USERS (${blocked.length})`}>
            {blocked.length === 0 ? (
              <p className="text-xs text-[#C76B94] font-['Pixelify_Sans']">No blocked users.</p>
            ) : (
              <div className="space-y-2">
                {blocked.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-[#FFB6D5] bg-[#FFF8FB] p-2.5 flex items-center justify-between"
                  >
                    <span className="font-['Pixelify_Sans'] text-xs text-[#3D1329]">@{b.username}</span>
                    <ChromeButton onClick={() => b.friendshipId && removeConnection(b.friendshipId)}>
                      Unblock
                    </ChromeButton>
                  </div>
                ))}
              </div>
            )}
          </PearlPanel>
        </div>
      )}

      {tab === 'sessions' && (
        <PearlPanel title="ACTIVE SESSIONS">
          <div className="space-y-2.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-[#FFB6D5] bg-[#FFF8FB] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-['Pixelify_Sans'] text-xs font-bold text-[#3D1329] truncate">
                    {s.deviceLabel} {s.isCurrent ? '(This Device)' : ''}
                  </p>
                  <p className="font-['VT323'] text-sm text-[#C76B94]">
                    Last active {formatShortDate(s.lastActiveAt)}
                  </p>
                </div>
                <ChromeButton onClick={() => revokeSession(s.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-[#F20B83]" />
                  {s.isCurrent ? 'Revoke & Lock' : 'Revoke'}
                </ChromeButton>
              </div>
            ))}
          </div>
        </PearlPanel>
      )}
    </div>
  );
}
