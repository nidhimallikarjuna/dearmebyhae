import React from 'react';
import {
  CalendarHeart,
  Camera,
  Heart,
  Hourglass,
  Mail,
  MessageCircleHeart,
  Mic,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  HeartClaim,
  NotificationItem,
  PostItem,
  SectionKey,
  UserSelf,
  VoiceNote,
} from '../types';
import {
  AvatarCircle,
  BowDivider,
  ChromeButton,
  FilmstripGallery,
  GlossyButton,
  MediaRenderer,
  PearlPanel,
  ResilientImage,
  formatShortDate,
} from '../components/RetroUI';

export interface DashboardData {
  recentPosts: PostItem[];
  recentVoices: VoiceNote[];
  todayClaim: HeartClaim | null;
  totalClaims: number;
  friendActivity: PostItem[];
  notifications: NotificationItem[];
  unreadMessagesCount: number;
  onThisDay: PostItem[];
  todayMood: { mood: string; note: string };
}

export function HomeDashboard({
  user,
  dashboard,
  onNavigate,
  onUpdateMood,
}: {
  user: UserSelf;
  dashboard: DashboardData | null;
  onNavigate: (section: SectionKey) => void;
  onUpdateMood: (mood: string) => void;
}) {
  const filmstripPhotos = (dashboard?.recentPosts || [])
    .flatMap((p) =>
      p.media
        .filter((m) => m.kind === 'image')
        .map((m) => ({ id: p.id, url: m.url, label: p.title }))
    )
    .slice(0, 8);

  const quickActions: Array<{
    key: SectionKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'life', label: 'Add Photo / Vlog', icon: Camera },
    { key: 'voice', label: 'Record Voice Note', icon: Mic },
    { key: 'letters', label: 'Write Future Letter', icon: Mail },
    { key: 'capsules', label: 'Seal Time Capsule', icon: Hourglass },
    { key: 'love', label: 'Save Thing I Love', icon: Sparkles },
  ];

  return (
    <div className="space-y-5">
      {/* Iconic Y2K Scrapbook Welcome Banner (inspired by Screenshot 3) */}
      <section className="pearl-frame rounded-3xl overflow-hidden bg-gradient-to-br from-[#FF7BB9] via-[#FF4FA3] to-[#F20B83] text-white p-5 sm:p-6 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="font-['VT323'] text-lg tracking-wider text-white/90">
              ♥ WELCOME BACK TO YOUR PINK WEB UNIVERSE
            </div>
            <h1 className="font-['Pixelify_Sans'] text-2xl sm:text-3xl font-bold leading-tight">
              dear, {user.displayName}.
            </h1>
            <p className="text-xs sm:text-sm text-white/90 max-w-xl">
              Your private 2000s digital diary, photo-blog, cassette studio, and cozy friend space.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/18 backdrop-blur-sm border border-white/40 rounded-2xl p-3 shrink-0">
            <AvatarCircle url={user.avatarUrl} name={user.displayName} size="lg" />
            <div>
              <p className="font-['Pixelify_Sans'] text-sm font-bold">@{user.username}</p>
              <p className="font-['VT323'] text-base text-white/90">
                {dashboard?.totalClaims || 0} / 365 Hearts Claimed
              </p>
              <button
                type="button"
                onClick={() => onNavigate('messages')}
                className="mt-1 inline-flex items-center gap-1 rounded-full bg-white text-[#F20B83] px-2.5 py-0.5 font-['Pixelify_Sans'] text-[11px] font-bold cursor-pointer hover:bg-[#FFF0F5]"
              >
                <MessageCircleHeart className="w-3 h-3" />
                {dashboard?.unreadMessagesCount || 0} Unread SMS
              </button>
            </div>
          </div>
        </div>

        {/* Tilted / Filmstrip Preview inside Welcome Banner if photos exist */}
        {filmstripPhotos.length > 0 && (
          <div className="mt-5 -rotate-[0.6deg]">
            <FilmstripGallery items={filmstripPhotos} onSelect={() => onNavigate('life')} />
          </div>
        )}
      </section>

      {/* Quick Create Bar */}
      <PearlPanel title="QUICK CREATE">
        <div className="flex flex-wrap gap-2.5">
          {quickActions.map((act) => {
            const Icon = act.icon;
            return (
              <GlossyButton key={act.key} onClick={() => onNavigate(act.key)} className="text-xs">
                <Plus className="w-3.5 h-3.5" />
                <Icon className="w-3.5 h-3.5" />
                <span>{act.label}</span>
              </GlossyButton>
            );
          })}
        </div>
      </PearlPanel>

      {/* Mobile Mood & Claim Your Heart Quick Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PearlPanel
          title="CLAIM YOUR HEART"
          rightSlot={
            <button
              type="button"
              onClick={() => onNavigate('heart')}
              className="font-['Pixelify_Sans'] text-xs text-white underline cursor-pointer"
            >
              Open
            </button>
          }
        >
          {dashboard?.todayClaim ? (
            <div className="space-y-2.5">
              <p className="font-['Serif'] italic text-base text-[#3D1329] leading-relaxed">
                “{dashboard.todayClaim.quoteText}”
              </p>
              <div className="flex items-center justify-between text-xs text-[#C76B94]">
                <span className="font-['VT323'] text-base">— {dashboard.todayClaim.quoteAuthor}</span>
                <span className="font-['Pixelify_Sans']">
                  Day {dashboard.totalClaims} of 365
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-['Pixelify_Sans'] text-sm font-bold text-[#F20B83]">
                  Your daily heart is ready!
                </p>
                <p className="text-xs text-[#7D1B4D] mt-0.5">
                  Tap to reveal today&apos;s unique diary quote.
                </p>
              </div>
              <GlossyButton onClick={() => onNavigate('heart')}>
                <Heart className="w-4 h-4 fill-white" /> Claim
              </GlossyButton>
            </div>
          )}
        </PearlPanel>

        <PearlPanel
          title="TODAY'S MOOD"
          rightSlot={
            <span className="font-['VT323'] text-base text-white uppercase">
              {dashboard?.todayMood.mood || user.moodToday}
            </span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {['dreamy', 'sparkly', 'cozy', 'nostalgic', 'soft', 'bold'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onUpdateMood(m)}
                className={`rounded-full px-3 py-1.5 text-xs font-['Pixelify_Sans'] border transition-colors cursor-pointer ${
                  (dashboard?.todayMood.mood || user.moodToday) === m
                    ? 'bg-[#F20B83] text-white border-[#B5055E]'
                    : 'bg-[#FFF0F5] text-[#7D1B4D] border-[#FFB6D5] hover:border-[#F20B83]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </PearlPanel>
      </div>

      {/* On This Day Preview */}
      {dashboard && dashboard.onThisDay.length > 0 && (
        <PearlPanel
          title="ON THIS DAY FLASHBACKS"
          rightSlot={
            <button
              type="button"
              onClick={() => onNavigate('onthisday')}
              className="font-['Pixelify_Sans'] text-xs text-white underline cursor-pointer"
            >
              See All
            </button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dashboard.onThisDay.map((mem) => (
              <div
                key={mem.id}
                className="rounded-xl border-2 border-[#FFB6D5] bg-[#FFF8FB] p-3 flex items-center gap-3"
              >
                {mem.media[0] ? (
                  <ResilientImage
                    src={mem.media[0].url}
                    alt={mem.title}
                    className="w-16 h-16 rounded-lg object-cover border border-[#FF69AD] shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-[#F8D8E6] flex items-center justify-center shrink-0">
                    <CalendarHeart className="w-6 h-6 text-[#F20B83]" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="font-['VT323'] text-base text-[#F20B83]">
                    {mem.yearsAgo} {mem.yearsAgo === 1 ? 'YEAR' : 'YEARS'} AGO TODAY
                  </span>
                  <h4 className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">{mem.title}</h4>
                  <p className="text-xs text-[#7D1B4D] line-clamp-1">{mem.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </PearlPanel>
      )}

      {/* Recent Photos & Vlogs */}
      <PearlPanel
        title="RECENT IN MY LITTLE LIFE"
        rightSlot={
          <button
            type="button"
            onClick={() => onNavigate('life')}
            className="font-['Pixelify_Sans'] text-xs text-white underline cursor-pointer"
          >
            Open Photo-Blog
          </button>
        }
      >
        {!dashboard || dashboard.recentPosts.length === 0 ? (
          <div className="text-center py-6 space-y-2.5">
            <p className="font-['Pixelify_Sans'] text-sm text-[#C76B94]">
              Your photo-blog is ready for your first Polaroid or Vlog!
            </p>
            <GlossyButton onClick={() => onNavigate('life')}>
              <Camera className="w-4 h-4" /> Post First Memory
            </GlossyButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard.recentPosts.slice(0, 3).map((post) => (
              <div
                key={post.id}
                onClick={() => onNavigate('life')}
                className="bg-white border-2 border-[#FFB6D5] rounded-xl p-2.5 shadow-sm hover:-translate-y-0.5 transition-transform cursor-pointer"
              >
                {post.media[0] ? (
                  <MediaRenderer
                    item={post.media[0]}
                    alt={post.title}
                    className="w-full aspect-[4/3] rounded-lg object-cover mb-2"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] rounded-lg bg-[#FFF0F5] flex items-center justify-center mb-2">
                    <Sparkles className="w-6 h-6 text-[#FF69AD]" />
                  </div>
                )}
                <p className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">{post.title}</p>
                <div className="flex items-center justify-between text-[11px] text-[#C76B94] mt-0.5">
                  <span className="font-['VT323'] text-sm">{formatShortDate(post.memoryDate)}</span>
                  <span className="font-['Pixelify_Sans']">{post.visibility === 'friends' ? 'Friends' : 'Private'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </PearlPanel>

      {/* Recent Voice Notes & Friend Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PearlPanel
          title="RECENT VOICE NOTES"
          rightSlot={
            <button
              type="button"
              onClick={() => onNavigate('voice')}
              className="font-['Pixelify_Sans'] text-xs text-white underline cursor-pointer"
            >
              Studio
            </button>
          }
        >
          {!dashboard || dashboard.recentVoices.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-[#C76B94] font-['Pixelify_Sans']">No private voice notes yet.</p>
              <ChromeButton onClick={() => onNavigate('voice')}>
                <Mic className="w-3.5 h-3.5" /> Record Audio
              </ChromeButton>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dashboard.recentVoices.map((v) => (
                <div key={v.id} className="rounded-xl border border-[#FFB6D5] bg-[#FFF8FB] p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-['Pixelify_Sans'] font-bold text-[#F20B83] truncate">{v.title}</span>
                    <span className="font-['VT323'] text-sm text-[#C76B94]">{Math.round(v.durationSec)}s</span>
                  </div>
                  <audio src={v.audioUrl} controls className="w-full h-8" />
                </div>
              ))}
            </div>
          )}
        </PearlPanel>

        <PearlPanel
          title="FRIEND MOMENTS"
          rightSlot={
            <button
              type="button"
              onClick={() => onNavigate('people')}
              className="font-['Pixelify_Sans'] text-xs text-white underline cursor-pointer"
            >
              My People
            </button>
          }
        >
          {!dashboard || dashboard.friendActivity.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-[#C76B94] font-['Pixelify_Sans']">
                Connect with friends to see moments they share with you.
              </p>
              <ChromeButton onClick={() => onNavigate('people')}>
                <Users className="w-3.5 h-3.5" /> Find Friends
              </ChromeButton>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dashboard.friendActivity.slice(0, 3).map((fp) => (
                <div key={fp.id} className="rounded-xl border border-[#FFB6D5] bg-[#FFF8FB] p-2.5 flex gap-2.5">
                  <AvatarCircle url={fp.author?.avatarUrl} name={fp.author?.displayName || '?'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-['Pixelify_Sans'] text-xs font-bold text-[#F20B83] truncate">
                        @{fp.author?.username}
                      </span>
                      <span className="font-['VT323'] text-sm text-[#C76B94]">{formatShortDate(fp.memoryDate)}</span>
                    </div>
                    <p className="text-xs font-medium text-[#3D1329] truncate">{fp.title}</p>
                    {fp.caption && <p className="text-[11px] text-[#7D1B4D] line-clamp-1">{fp.caption}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PearlPanel>
      </div>

      <BowDivider label="dear, me. 2005" />
    </div>
  );
}
