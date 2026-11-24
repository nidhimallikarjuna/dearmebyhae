export type SectionKey =
  | 'home'
  | 'life'
  | 'voice'
  | 'love'
  | 'heart'
  | 'letters'
  | 'capsules'
  | 'onthisday'
  | 'people'
  | 'messages'
  | 'settings';

export type WallpaperId = 'gingham' | 'pearl-satin' | 'pixel-phone' | 'starry-blush';

export interface UserSelf {
  id: string;
  username: string;
  displayName: string;
  email: string;
  pinEnabled: boolean;
  avatarMediaId: string;
  avatarUrl: string;
  bio: string;
  moodToday: string;
  wallpaperId: WallpaperId;
  privacyDefault: 'private' | 'friends';
  notifyMessages: boolean;
  notifyFriends: boolean;
  notifyCapsules: boolean;
  createdAt: string;
}

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  moodToday: string;
  avatarUrl: string;
  createdAt: string;
  friendshipId?: string;
  relation?: string;
}

export interface MediaItem {
  id: string;
  mimeType: string;
  kind: 'image' | 'video' | 'audio';
  originalName: string;
  sizeBytes: number;
  url: string;
}

export interface PostItem {
  id: string;
  title: string;
  caption: string;
  mood: string;
  postType: 'photo' | 'photodump' | 'vlog' | 'moment';
  visibility: 'private' | 'friends';
  memoryDate: string;
  createdAt: string;
  media: MediaItem[];
  yearsAgo?: number;
  author?: UserPublic;
}

export interface VoiceNote {
  id: string;
  title: string;
  mood: string;
  durationSec: number;
  waveform: number[];
  recordedAt: string;
  createdAt: string;
  audioUrl: string;
}

export interface LoveItem {
  id: string;
  category: string;
  collectionName: string;
  title: string;
  note: string;
  linkUrl: string;
  imageUrl: string;
  createdAt: string;
}

export interface HeartClaim {
  id: string;
  claimDate: string;
  quoteIndex: number;
  quoteText: string;
  quoteAuthor: string;
  isFavorite: boolean;
  createdAt?: string;
}

export interface LetterItem {
  id: string;
  title: string;
  body: string;
  sealColor: string;
  stationeryStyle: string;
  deliverOn: string;
  isLocked: boolean;
  createdAt: string;
}

export interface CapsuleItem {
  id: string;
  title: string;
  message: string;
  unlockAt: string;
  themeBox: string;
  isLocked: boolean;
  mediaCount: number;
  media: MediaItem[];
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  isGroup: boolean;
  title: string;
  members: UserPublic[];
  lastMessage: {
    body: string;
    senderUsername: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageReaction {
  emoji: string;
  user_id: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  body: string;
  media: MediaItem | null;
  reactions: MessageReaction[];
  readByOthers: boolean;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  refId: string;
  isRead: boolean;
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}
