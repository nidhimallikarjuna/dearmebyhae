import React, { useEffect, useState } from 'react';
import {
  Check,
  MessageCircleHeart,
  Search,
  ShieldBan,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../api';
import type { PostItem, UserPublic } from '../types';
import {
  AvatarCircle,
  ChromeButton,
  GlossyButton,
  MediaRenderer,
  PearlPanel,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

export function MyPeople({
  onOpenChat,
}: {
  onOpenChat: (conversationId: string) => void;
}) {
  const [friends, setFriends] = useState<UserPublic[]>([]);
  const [incoming, setIncoming] = useState<UserPublic[]>([]);
  const [outgoing, setOutgoing] = useState<UserPublic[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPublic[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState<{
    profile: UserPublic;
    sharedMoments: PostItem[];
  } | null>(null);

  // Group chat creation
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const loadPeople = async () => {
    const res = await apiFetch<{
      friends: UserPublic[];
      incomingRequests: UserPublic[];
      outgoingRequests: UserPublic[];
    }>('/api/people');
    setFriends(res.friends);
    setIncoming(res.incomingRequests);
    setOutgoing(res.outgoingRequests);
  };

  useEffect(() => {
    void loadPeople();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const res = await apiFetch<{ results: UserPublic[] }>(
        `/api/people/search?q=${encodeURIComponent(query.trim())}`
      );
      setSearchResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetUserId: string) => {
    setError('');
    try {
      await apiFetch('/api/people/request', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, relation: 'outgoing' } : u))
      );
      await loadPeople();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send friend request.');
    }
  };

  const respondRequest = async (friendshipId: string, action: 'accept' | 'decline') => {
    await apiFetch('/api/people/respond', {
      method: 'POST',
      body: JSON.stringify({ friendshipId, action }),
    });
    await loadPeople();
  };

  const openProfile = async (friendId: string) => {
    setError('');
    try {
      const res = await apiFetch<{ profile: UserPublic; sharedMoments: PostItem[] }>(
        `/api/people/${friendId}/profile`
      );
      setSelectedProfile(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to view friend profile.');
    }
  };

  const startDm = async (friendId: string) => {
    const res = await apiFetch<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ memberIds: [friendId], isGroup: false }),
    });
    onOpenChat(res.id);
  };

  const createGroupChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (groupMemberIds.length === 0) return;
    const res = await apiFetch<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        memberIds: groupMemberIds,
        isGroup: true,
        name: groupName.trim() || 'Pink Squad',
      }),
    });
    setShowGroupModal(false);
    setGroupName('');
    setGroupMemberIds([]);
    onOpenChat(res.id);
  };

  const blockUser = async (targetUserId: string) => {
    await apiFetch('/api/people/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
    if (selectedProfile?.profile.id === targetUserId) setSelectedProfile(null);
    await loadPeople();
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag="Y2K TOP FRIENDS & SHARED MOMENTS"
        title="My People"
        subtitle="Search usernames, manage friend requests, view shared moments, and start group chats."
        rightAction={
          friends.length > 0 && (
            <GlossyButton onClick={() => setShowGroupModal((v) => !v)}>
              <Users className="w-4 h-4" /> New Group Chat
            </GlossyButton>
          )
        }
      />

      {error && (
        <div className="rounded-xl bg-[#FFE3EF] border border-[#F20B83] px-4 py-2 text-xs text-[#A30554]">
          {error}
        </div>
      )}

      {/* Create Group Chat Box */}
      {showGroupModal && (
        <PearlPanel
          title="CREATE PINK GROUP CHAT"
          rightSlot={
            <button type="button" onClick={() => setShowGroupModal(false)} className="text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          }
        >
          <form onSubmit={createGroupChat} className="space-y-3">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Strawberry Club)"
              className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
            />
            <div className="flex flex-wrap gap-2">
              {friends.map((f) => {
                const picked = groupMemberIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setGroupMemberIds((prev) =>
                        picked ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-['Pixelify_Sans'] border flex items-center gap-1.5 cursor-pointer ${
                      picked
                        ? 'bg-[#F20B83] text-white border-[#B5055E]'
                        : 'bg-[#FFF0F5] text-[#7D1B4D] border-[#FFB6D5]'
                    }`}
                  >
                    <span>@{f.username}</span>
                  </button>
                );
              })}
            </div>
            <GlossyButton type="submit" disabled={groupMemberIds.length === 0}>
              Start Group Chat ({groupMemberIds.length})
            </GlossyButton>
          </form>
        </PearlPanel>
      )}

      {/* Search Users */}
      <PearlPanel title="FIND FRIENDS BY USERNAME">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search @username or name..."
            className="flex-1 rounded-full border-2 border-[#FFB6D5] bg-white px-4 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
          />
          <GlossyButton type="submit" disabled={searching}>
            <Search className="w-4 h-4" /> Search
          </GlossyButton>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-[#FFB6D5] bg-[#FFF8FB] p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarCircle url={u.avatarUrl} name={u.displayName} size="md" />
                  <div className="min-w-0">
                    <p className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">
                      {u.displayName}
                    </p>
                    <p className="font-['VT323'] text-base text-[#C76B94] leading-none">@{u.username}</p>
                  </div>
                </div>

                {u.relation === 'accepted' ? (
                  <ChromeButton onClick={() => startDm(u.id)}>
                    <MessageCircleHeart className="w-3.5 h-3.5 text-[#F20B83]" /> Message
                  </ChromeButton>
                ) : u.relation === 'outgoing' ? (
                  <span className="font-['Pixelify_Sans'] text-xs text-[#C76B94]">Request Sent</span>
                ) : (
                  <GlossyButton onClick={() => sendRequest(u.id)} className="text-xs px-3 py-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> Add Friend
                  </GlossyButton>
                )}
              </div>
            ))}
          </div>
        )}
      </PearlPanel>

      {/* Incoming Friend Requests */}
      {incoming.length > 0 && (
        <PearlPanel title="FRIEND REQUESTS">
          <div className="space-y-2.5">
            {incoming.map((reqUser) => (
              <div
                key={reqUser.id}
                className="rounded-xl border-2 border-[#FF69AD] bg-[#FFF0F5] p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarCircle url={reqUser.avatarUrl} name={reqUser.displayName} size="md" />
                  <div className="min-w-0">
                    <p className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">
                      {reqUser.displayName}
                    </p>
                    <p className="font-['VT323'] text-base text-[#C76B94] leading-none">@{reqUser.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <GlossyButton
                    onClick={() => reqUser.friendshipId && respondRequest(reqUser.friendshipId, 'accept')}
                    className="text-xs px-3 py-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </GlossyButton>
                  <ChromeButton
                    onClick={() => reqUser.friendshipId && respondRequest(reqUser.friendshipId, 'decline')}
                  >
                    <X className="w-3.5 h-3.5" /> Decline
                  </ChromeButton>
                </div>
              </div>
            ))}
          </div>
        </PearlPanel>
      )}

      {/* Selected Friend Profile & Explicitly Shared Moments */}
      {selectedProfile && (
        <PearlPanel
          title={`@${selectedProfile.profile.username.toUpperCase()}'S SHARED PROFILE`}
          rightSlot={
            <button type="button" onClick={() => setSelectedProfile(null)} className="text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dotted border-[#FFB6D5]">
            <div className="flex items-center gap-3">
              <AvatarCircle
                url={selectedProfile.profile.avatarUrl}
                name={selectedProfile.profile.displayName}
                size="lg"
              />
              <div>
                <h3 className="font-['Pixelify_Sans'] text-lg font-bold text-[#F20B83]">
                  {selectedProfile.profile.displayName}
                </h3>
                <p className="font-['VT323'] text-base text-[#C76B94]">
                  @{selectedProfile.profile.username} · Mood: {selectedProfile.profile.moodToday}
                </p>
                <p className="text-xs text-[#7D1B4D] mt-1">{selectedProfile.profile.bio}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GlossyButton onClick={() => startDm(selectedProfile.profile.id)}>
                <MessageCircleHeart className="w-4 h-4" /> Message
              </GlossyButton>
              <ChromeButton onClick={() => blockUser(selectedProfile.profile.id)}>
                <ShieldBan className="w-3.5 h-3.5 text-[#F20B83]" /> Block
              </ChromeButton>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-['Pixelify_Sans'] text-xs text-[#F20B83] mb-3">
              SHARED DAILY MOMENTS (PRIVATE ENTRIES REMAIN HIDDEN)
            </h4>
            {selectedProfile.sharedMoments.length === 0 ? (
              <p className="text-xs text-[#C76B94] py-4 text-center font-['Pixelify_Sans']">
                No moments shared with friends yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedProfile.sharedMoments.map((m) => (
                  <div key={m.id} className="rounded-xl border border-[#FFB6D5] bg-[#FFF8FB] p-3 space-y-2">
                    {m.media[0] && (
                      <MediaRenderer item={m.media[0]} alt={m.title} className="w-full h-40 rounded-lg object-cover" />
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-['Pixelify_Sans'] font-bold text-[#3D1329]">{m.title}</span>
                      <span className="font-['VT323'] text-sm text-[#C76B94]">{formatShortDate(m.memoryDate)}</span>
                    </div>
                    {m.caption && <p className="text-xs text-[#7D1B4D]">{m.caption}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </PearlPanel>
      )}

      {/* Accepted Friends List */}
      <PearlPanel title={`MY FRIENDS (${friends.length})`}>
        {friends.length === 0 ? (
          <div className="text-center py-6 space-y-1.5">
            <UserCheck className="w-8 h-8 mx-auto text-[#FFB6D5]" />
            <p className="font-['Pixelify_Sans'] text-sm text-[#C76B94]">
              No friends added yet. Search for a friend&apos;s username above!
            </p>
            {outgoing.length > 0 && (
              <p className="font-['VT323'] text-base text-[#7D1B4D]">
                {outgoing.length} pending outgoing request(s)
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {friends.map((f) => (
              <div
                key={f.id}
                className="rounded-2xl border-2 border-[#FFB6D5] bg-[#FFF8FB] p-3 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => openProfile(f.id)}
                  className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                >
                  <AvatarCircle url={f.avatarUrl} name={f.displayName} size="md" />
                  <div className="min-w-0">
                    <p className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate hover:text-[#F20B83]">
                      {f.displayName}
                    </p>
                    <p className="font-['VT323'] text-base text-[#C76B94] leading-none truncate">
                      @{f.username} · {f.moodToday}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ChromeButton onClick={() => openProfile(f.id)}>Profile</ChromeButton>
                  <GlossyButton onClick={() => startDm(f.id)} className="px-3 py-1.5 text-xs">
                    <MessageCircleHeart className="w-3.5 h-3.5" />
                  </GlossyButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </PearlPanel>
    </div>
  );
}
