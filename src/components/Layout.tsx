import React, { useState } from 'react';
import {
  Bell,
  CalendarHeart,
  Camera,
  Heart,
  Home,
  Hourglass,
  Lock,
  Mail,
  Menu,
  MessageCircleHeart,
  Mic,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { HeartClaim, NotificationItem, PostItem, SectionKey, UserSelf } from '../types';
import { AvatarCircle, ChromeButton, DottedPanel, GlossyButton, formatShortDate } from './RetroUI';

export const NAV_ITEMS: Array<{
  key: SectionKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  privateTag?: boolean;
}> = [
  { key: 'home', label: 'Home', shortLabel: 'Home', icon: Home },
  { key: 'life', label: 'My Little Life', shortLabel: 'Life', icon: Camera },
  { key: 'voice', label: 'Voice Diary', shortLabel: 'Voice', icon: Mic, privateTag: true },
  { key: 'love', label: 'Things I Love', shortLabel: 'Love', icon: Sparkles, privateTag: true },
  { key: 'heart', label: 'Claim Your Heart', shortLabel: 'Heart', icon: Heart },
  { key: 'letters', label: 'Letters to Myself', shortLabel: 'Letters', icon: Mail, privateTag: true },
  { key: 'capsules', label: 'Time Capsules', shortLabel: 'Capsules', icon: Hourglass, privateTag: true },
  { key: 'onthisday', label: 'On This Day', shortLabel: 'Memories', icon: CalendarHeart },
  { key: 'people', label: 'My People', shortLabel: 'People', icon: Users },
  { key: 'messages', label: 'Messaging', shortLabel: 'Chat', icon: MessageCircleHeart },
  { key: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

const MOODS = [
  { id: 'dreamy', label: 'Dreamy' },
  { id: 'sparkly', label: 'Sparkly' },
  { id: 'cozy', label: 'Cozy' },
  { id: 'nostalgic', label: 'Nostalgic' },
  { id: 'soft', label: 'Soft' },
];

export function Layout({
  user,
  activeSection,
  onSelectSection,
  onLock,
  notifications,
  unreadMessagesCount,
  onMarkNotificationsRead,
  todayClaim,
  onThisDayCount,
  todayMood,
  onUpdateMood,
  children,
}: {
  user: UserSelf;
  activeSection: SectionKey;
  onSelectSection: (section: SectionKey) => void;
  onLock: () => void;
  notifications: NotificationItem[];
  unreadMessagesCount: number;
  onMarkNotificationsRead: () => void;
  todayClaim: HeartClaim | null;
  onThisDayCount: number;
  todayMood: { mood: string; note: string };
  onUpdateMood: (mood: string) => void;
  children: React.ReactNode;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const activeMeta = NAV_ITEMS.find((n) => n.key === activeSection) || NAV_ITEMS[0];

  const primaryTopNav: SectionKey[] = ['home', 'life', 'voice', 'heart', 'messages'];

  return (
    <div className="min-h-screen y2k-stripes text-[#3D1329] pb-20 lg:pb-10">
      {/* Desktop Retro Safari / Mac OS Window Chrome */}
      <div className="hidden lg:block sticky top-0 z-30 shadow-sm">
        <div className="safari-chrome px-4 py-1.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
            <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
            <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
          </div>

          <div className="flex-1 max-w-xl bg-white/95 border border-[#B9B9C2] rounded-full px-3 py-1 flex items-center gap-2 text-xs text-[#7D1B4D]">
            <Heart className="w-3.5 h-3.5 fill-[#F20B83] text-[#F20B83] shrink-0" />
            <span className="font-['VT323'] text-base tracking-wide truncate">
              http://dear-me.diary/@{user.username}/{activeSection}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                if (!notifOpen && unreadNotifCount > 0) onMarkNotificationsRead();
              }}
              className="chrome-btn rounded-full px-3 py-1 text-xs relative cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#F20B83]" />
              <span>Alerts</span>
              {unreadNotifCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#F20B83] text-white font-['VT323'] text-sm leading-none">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            <GlossyButton onClick={onLock} className="px-3 py-1 text-xs">
              <Lock className="w-3.5 h-3.5" />
              Lock Diary
            </GlossyButton>
          </div>
        </div>

        {/* Iconic Y2K Pink Top Navigation Banner (inspired by Screenshot 1 & 3) */}
        <header className="relative bg-gradient-to-r from-[#FF85BE] via-[#FFB6D5] to-[#FF85BE] border-b-2 border-[#F20B83] shadow-sm">
          <div className="max-w-[1320px] mx-auto px-5 py-2.5 flex items-center justify-between gap-8">
            <button
              type="button"
              onClick={() => onSelectSection('home')}
              className="font-['Pixelify_Sans'] text-2xl font-bold text-white drop-shadow-[0_2px_0_#C7066B] whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <span>dear, me.</span>
              <span className="text-lg" aria-hidden="true">♡</span>
            </button>

            <nav className="flex items-center gap-6 overflow-x-auto">
              {primaryTopNav.map((key) => {
                const item = NAV_ITEMS.find((n) => n.key === key)!;
                const active = activeSection === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectSection(key)}
                    className={`font-['Pixelify_Sans'] text-sm whitespace-nowrap shrink-0 cursor-pointer pb-0.5 transition-colors flex items-center gap-1.5 ${
                      active
                        ? 'text-white font-bold border-b-2 border-white'
                        : 'text-[#7D1B4D] hover:text-white font-medium'
                    }`}
                  >
                    <span>{item.label}</span>
                    {key === 'messages' && unreadMessagesCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#F20B83] text-white font-['VT323'] text-sm leading-none">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="shrink-0">
              <GlossyButton onClick={() => onSelectSection('life')} className="text-xs px-3.5 py-1.5">
                + New Memory
              </GlossyButton>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Compact Header (< 10% viewport height) */}
      <header className="lg:hidden sticky top-0 z-30 h-13 glossy-pink-bar px-3.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelectSection('home')}
          className="font-['Pixelify_Sans'] text-lg font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          dear, me. ♡
        </button>

        <span className="font-['Pixelify_Sans'] text-xs text-white/95 truncate">{activeMeta.label}</span>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              if (!notifOpen && unreadNotifCount > 0) onMarkNotificationsRead();
            }}
            aria-label="Notifications"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white/20 text-white flex items-center justify-center relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#FFF0F5] border border-[#F20B83]" />
            )}
          </button>
          <button
            type="button"
            onClick={onLock}
            aria-label="Lock Diary"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white text-[#F20B83] flex items-center justify-center shadow-sm cursor-pointer"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Notification Popover (Screenshot 2 "MASAGGE" Retro Alert Aesthetic) */}
      {notifOpen && (
        <div className="fixed top-14 right-3 sm:right-6 z-50 w-[310px] sm:w-[340px] pearl-frame rounded-2xl overflow-hidden shadow-xl">
          <div className="glossy-pink-bar px-3.5 py-2 flex items-center justify-between">
            <span className="font-['Pixelify_Sans'] text-xs text-white">MASAGGE & ALERTS</span>
            <button
              type="button"
              onClick={() => setNotifOpen(false)}
              className="text-white hover:opacity-80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-3 space-y-2 bg-[#FFF8FB]">
            {notifications.length === 0 ? (
              <p className="text-xs text-[#C76B94] text-center py-4 font-['Pixelify_Sans']">
                No new alerts right now.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    if (n.type === 'message') onSelectSection('messages');
                    else if (n.type.startsWith('friend')) onSelectSection('people');
                  }}
                  className="w-full text-left rounded-xl border-2 border-[#FFB6D5] bg-white p-2.5 hover:border-[#F20B83] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-['Pixelify_Sans'] text-xs font-bold text-[#F20B83] truncate">
                      {n.title}
                    </span>
                    <span className="font-['VT323'] text-sm text-[#C76B94] shrink-0">
                      {formatShortDate(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[#3D1329] line-clamp-2">{n.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Centered 3-Column Retro Personal Site Shell */}
      <div className="max-w-[1320px] mx-auto px-3 sm:px-5 pt-4 sm:pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_240px] gap-5 items-start">
          {/* LEFT SIDEBAR: Profile & Full Directory (Desktop) */}
          <aside className="hidden lg:block space-y-4 sticky top-[106px]">
            <DottedPanel label="MY PROFILE">
              <div className="flex items-center gap-3 mb-3">
                <AvatarCircle url={user.avatarUrl} name={user.displayName} size="lg" />
                <div className="min-w-0">
                  <p className="font-['Pixelify_Sans'] font-bold text-base text-[#F20B83] truncate">
                    {user.displayName}
                  </p>
                  <p className="font-['VT323'] text-base text-[#C76B94] leading-none truncate">@{user.username}</p>
                </div>
              </div>
              <p className="text-xs text-[#7D1B4D] leading-relaxed mb-3">{user.bio}</p>
              <div className="text-[11px] text-[#C76B94] font-['Pixelify_Sans'] flex items-center justify-between border-t border-dotted border-[#FFB6D5] pt-2">
                <span>Mood: {todayMood.mood}</span>
                <button
                  type="button"
                  onClick={() => onSelectSection('settings')}
                  className="text-[#F20B83] hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </div>
            </DottedPanel>

            <DottedPanel label="DIARY MENU">
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onSelectSection(item.key)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        active
                          ? 'glossy-pink-bar text-white font-semibold'
                          : 'text-[#7D1B4D] hover:bg-[#FFF0F5] hover:text-[#F20B83]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate font-['Pixelify_Sans'] text-[13px]">{item.label}</span>
                      </span>
                      {item.key === 'messages' && unreadMessagesCount > 0 ? (
                        <span className="px-1.5 rounded-full bg-white text-[#F20B83] font-['VT323'] text-sm leading-none">
                          {unreadMessagesCount}
                        </span>
                      ) : item.privateTag ? (
                        <Lock className={`w-3 h-3 shrink-0 ${active ? 'text-white/80' : 'text-[#C76B94]'}`} />
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </DottedPanel>
          </aside>

          {/* MAIN CONTENT WINDOW */}
          <main className="min-w-0 space-y-5">{children}</main>

          {/* RIGHT SIDEBAR: Retro Widgets (Desktop) */}
          <aside className="hidden lg:block space-y-4 sticky top-[106px]">
            <DottedPanel label="DAILY MOOD">
              <p className="text-xs text-[#7D1B4D] mb-2 font-['Pixelify_Sans']">How is your heart today?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateMood(m.id)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-['Pixelify_Sans'] border transition-colors cursor-pointer ${
                      todayMood.mood === m.id
                        ? 'bg-[#F20B83] text-white border-[#B5055E]'
                        : 'bg-[#FFF0F5] text-[#7D1B4D] border-[#FFB6D5] hover:border-[#F20B83]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </DottedPanel>

            <DottedPanel label="CLAIM YOUR HEART">
              {todayClaim ? (
                <div className="space-y-2">
                  <p className="font-['Serif'] italic text-xs text-[#3D1329] leading-relaxed">
                    “{todayClaim.quoteText}”
                  </p>
                  <p className="font-['VT323'] text-sm text-[#C76B94]">— {todayClaim.quoteAuthor}</p>
                  <ChromeButton onClick={() => onSelectSection('heart')} className="w-full text-[11px]">
                    View Archive
                  </ChromeButton>
                </div>
              ) : (
                <div className="text-center space-y-2.5">
                  <Heart className="w-8 h-8 mx-auto text-[#F20B83] fill-[#FFB6D5] animate-float" />
                  <p className="text-xs text-[#7D1B4D]">Today&apos;s daily heart quote is waiting!</p>
                  <GlossyButton onClick={() => onSelectSection('heart')} className="w-full text-xs py-1.5">
                    Claim Heart
                  </GlossyButton>
                </div>
              )}
            </DottedPanel>

            <DottedPanel label="ON THIS DAY">
              <p className="text-xs text-[#7D1B4D] mb-2">
                {onThisDayCount > 0
                  ? `${onThisDayCount} nostalgic ${onThisDayCount === 1 ? 'memory' : 'memories'} from past years today.`
                  : 'Save dated photos in My Little Life to unlock yearly flashbacks.'}
              </p>
              <ChromeButton onClick={() => onSelectSection('onthisday')} className="w-full text-[11px]">
                Open Memory Vault
              </ChromeButton>
            </DottedPanel>
          </aside>
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-15 bg-white/95 backdrop-blur-md border-t-2 border-[#FFB6D5] grid grid-cols-5 items-center px-1">
        {(['home', 'life', 'voice', 'messages'] as SectionKey[]).map((key) => {
          const item = NAV_ITEMS.find((n) => n.key === key)!;
          const Icon = item.icon;
          const active = activeSection === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMobileMoreOpen(false);
                onSelectSection(key);
              }}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer relative ${
                active ? 'text-[#F20B83]' : 'text-[#C76B94]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-['Pixelify_Sans'] text-[10px] leading-none">{item.shortLabel}</span>
              {key === 'messages' && unreadMessagesCount > 0 && (
                <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-[#F20B83]" />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMoreOpen((v) => !v)}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            mobileMoreOpen ? 'text-[#F20B83]' : 'text-[#C76B94]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="font-['Pixelify_Sans'] text-[10px] leading-none">More</span>
        </button>
      </nav>

      {/* Mobile More Menu Drawer */}
      {mobileMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#3D1329]/45 backdrop-blur-xs flex items-end">
          <div className="w-full rounded-t-3xl bg-[#FFF8FB] border-t-2 border-[#FF69AD] p-4 pb-8 max-h-[82vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <AvatarCircle url={user.avatarUrl} name={user.displayName} size="sm" />
                <div>
                  <p className="font-['Pixelify_Sans'] text-sm font-bold text-[#F20B83]">{user.displayName}</p>
                  <p className="font-['VT323'] text-sm text-[#C76B94] leading-none">@{user.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#F20B83] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      onSelectSection(item.key);
                    }}
                    className={`min-h-[44px] flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left cursor-pointer ${
                      active
                        ? 'glossy-pink-bar text-white border-[#B5055E]'
                        : 'bg-white text-[#7D1B4D] border-[#FFB6D5]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="font-['Pixelify_Sans'] text-xs truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
