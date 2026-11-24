import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  Heart,
  ImagePlus,
  MessageCircleHeart,
  Mic,
  Send,
  Square,
  Users,
} from 'lucide-react';
import { apiFetch, apiUpload } from '../api';
import type { ChatMessage, ConversationItem, UserSelf } from '../types';
import {
  AvatarCircle,
  GlossyButton,
  MediaRenderer,
  SectionHeader,
  formatPixelTime,
} from '../components/RetroUI';

const FLIP_PHONE_IMG = '/src/assets/images/y2k_flip_phone_1795533103531.jpg';

export function Messaging({
  user,
  selectedConversationId,
  onSelectConversation,
  wsEvent,
  sendTyping,
  onMessagesRead,
}: {
  user: UserSelf;
  selectedConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  wsEvent: Record<string, unknown> | null;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  onMessagesRead: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [recordingVoice, setRecordingVoice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const loadConversations = async () => {
    const res = await apiFetch<{ conversations: ConversationItem[] }>('/api/conversations');
    setConversations(res.conversations);
    if (!selectedConversationId && res.conversations.length > 0 && window.innerWidth >= 1024) {
      onSelectConversation(res.conversations[0].id);
    }
  };

  const loadMessages = async (convId: string) => {
    const res = await apiFetch<{ messages: ChatMessage[] }>(`/api/conversations/${convId}/messages`);
    setMessages(res.messages);
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)));
    onMessagesRead();
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversationId) {
      void loadMessages(selectedConversationId);
    }
  }, [selectedConversationId]);

  // Handle realtime WebSocket updates
  useEffect(() => {
    if (!wsEvent) return;
    if (wsEvent.type === 'message:new') {
      const incomingMsg = wsEvent.message as ChatMessage;
      const convId = String(wsEvent.conversationId || '');
      if (convId === selectedConversationId) {
        setMessages((prev) => (prev.some((m) => m.id === incomingMsg.id) ? prev : [...prev, incomingMsg]));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
        // Acknowledge read
        void apiFetch(`/api/conversations/${convId}/messages`);
      }
      void loadConversations();
    } else if (wsEvent.type === 'message:reaction') {
      const msgId = String(wsEvent.messageId || '');
      const reactions = (wsEvent.reactions as ChatMessage['reactions']) || [];
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions } : m)));
    } else if (wsEvent.type === 'typing' && wsEvent.conversationId === selectedConversationId) {
      const uid = String(wsEvent.userId || '');
      if (uid && uid !== user.id) {
        setTypingUsers((prev) => ({ ...prev, [uid]: Boolean(wsEvent.isTyping) }));
      }
    } else if (wsEvent.type === 'read' && wsEvent.conversationId === selectedConversationId) {
      setMessages((prev) => prev.map((m) => (m.senderId === user.id ? { ...m, readByOthers: true } : m)));
    }
  }, [wsEvent, selectedConversationId]);

  const activeConv = conversations.find((c) => c.id === selectedConversationId) || null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversationId || !draft.trim() || sending) return;
    setSending(true);
    try {
      sendTyping(selectedConversationId, false);
      await apiFetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft }),
      });
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversationId) return;
    setSending(true);
    try {
      const uploaded = await apiUpload([file], 'message', selectedConversationId);
      await apiFetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft.trim(), mediaId: uploaded[0].id }),
      });
      setDraft('');
    } finally {
      setSending(false);
      e.target.value = '';
    }
  };

  const toggleVoiceMessage = async () => {
    if (!selectedConversationId) return;
    if (recordingVoice) {
      mediaRecorderRef.current?.stop();
      setRecordingVoice(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunksRef.current = [];
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(voiceChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const file = new File([blob], `sms-voice-${Date.now()}.webm`, { type: blob.type });
        const uploaded = await apiUpload([file], 'message', selectedConversationId);
        await apiFetch(`/api/conversations/${selectedConversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body: '', mediaId: uploaded[0].id }),
        });
      };
      rec.start();
      setRecordingVoice(true);
    } catch {
      // mic denied
    }
  };

  const toggleHeartReaction = async (messageId: string) => {
    await apiFetch(`/api/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji: '♥' }),
    });
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (!selectedConversationId) return;
    sendTyping(selectedConversationId, Boolean(val.trim()));
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      sendTyping(selectedConversationId, false);
    }, 1800);
  };

  const someoneTyping = Object.values(typingUsers).some(Boolean);

  return (
    <div className="space-y-4">
      <SectionHeader
        pixelTag="Y2K MOBILE SMS & GROUP CHATS · REALTIME"
        title="Messaging"
        subtitle="Retro pink chat bubbles, pixel timestamps, heart reactions, voice & photo messages."
        illustrationUrl={FLIP_PHONE_IMG}
      />

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-stretch">
        {/* Conversation List */}
        <aside
          className={`pearl-frame rounded-2xl overflow-hidden bg-white ${
            selectedConversationId ? 'hidden md:block' : 'block'
          }`}
        >
          <div className="glossy-pink-bar px-4 py-2.5 flex items-center justify-between">
            <span className="font-['Pixelify_Sans'] text-xs text-white">INBOX ({conversations.length})</span>
            <MessageCircleHeart className="w-4 h-4 text-white" />
          </div>
          <div className="divide-y divide-dotted divide-[#FFB6D5] max-h-[520px] overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="p-5 text-center font-['Pixelify_Sans'] text-xs text-[#C76B94]">
                No chats yet. Add friends in My People to start messaging!
              </p>
            ) : (
              conversations.map((conv) => {
                const other = conv.members.find((m) => m.id !== user.id);
                const active = conv.id === selectedConversationId;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className={`w-full p-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                      active ? 'bg-[#FFF0F5]' : 'hover:bg-[#FFF8FB]'
                    }`}
                  >
                    {conv.isGroup ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF85BE] to-[#F20B83] text-white flex items-center justify-center shrink-0 border-2 border-[#FFB6D5]">
                        <Users className="w-4 h-4" />
                      </div>
                    ) : (
                      <AvatarCircle url={other?.avatarUrl} name={conv.title} size="md" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-['Pixelify_Sans'] font-bold text-xs text-[#3D1329] truncate">
                          {conv.title}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="px-1.5 rounded-full bg-[#F20B83] text-white font-['VT323'] text-sm leading-none">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#C76B94] truncate">
                        {conv.lastMessage ? conv.lastMessage.body : 'Say hai!'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Retro Pink Phone Chat Interface (inspired by Screenshot 2 & 4) */}
        <section
          className={`rounded-[28px] border-4 border-[#FF69AD] bg-gradient-to-b from-[#FFD2E7] via-[#FFF8FB] to-[#FFF0F5] shadow-xl overflow-hidden flex flex-col min-h-[540px] max-h-[650px] ${
            !selectedConversationId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <img
                src={FLIP_PHONE_IMG}
                alt="Pink flip phone"
                className="w-24 h-24 rounded-full object-cover border-2 border-[#FFB6D5]"
              />
              <p className="font-['Pixelify_Sans'] text-base font-bold text-[#F20B83]">
                Select a chat to open your pink phone
              </p>
              <p className="text-xs text-[#7D1B4D]">
                Only accepted friends and group members can see messages here.
              </p>
            </div>
          ) : (
            <>
              {/* Phone Top Bar */}
              <div className="glossy-pink-bar px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectConversation(null)}
                    className="md:hidden text-white p-1 cursor-pointer"
                    aria-label="Back to inbox"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <AvatarCircle
                    url={activeConv.isGroup ? '' : activeConv.members.find((m) => m.id !== user.id)?.avatarUrl}
                    name={activeConv.title}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="font-['Pixelify_Sans'] font-bold text-sm text-white truncate">
                      {activeConv.title}
                    </p>
                    <p className="font-['VT323'] text-sm text-white/90 leading-none">
                      {activeConv.isGroup
                        ? `${activeConv.members.length} members`
                        : `@${activeConv.members.find((m) => m.id !== user.id)?.username || ''}`}
                    </p>
                  </div>
                </div>

                {/* 5 Pink Pixel Hearts (inspired by Screenshot 2) */}
                <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Heart key={i} className="w-3.5 h-3.5 fill-white text-white opacity-90" />
                  ))}
                </div>
              </div>

              {/* Chat Canvas */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white/80">
                <div className="text-center my-1">
                  <span className="inline-block bg-[#9E9EA8] text-white font-['VT323'] text-base px-3 py-0.5 rounded">
                    TODAY
                  </span>
                </div>

                {messages.map((msg) => {
                  const isMe = msg.senderId === user.id;
                  const heartCount = msg.reactions.length;
                  const iReacted = msg.reactions.some((r) => r.user_id === user.id);

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isMe && (
                        <AvatarCircle url={msg.senderAvatarUrl} name={msg.senderDisplayName} size="sm" />
                      )}

                      {isMe && (
                        <div className="flex flex-col items-end shrink-0 text-[#C76B94]">
                          <span className="font-['VT323'] text-sm leading-none">
                            {formatPixelTime(msg.createdAt)}
                          </span>
                          {msg.readByOthers && (
                            <CheckCheck className="w-3.5 h-3.5 text-[#F20B83]" aria-label="Read" />
                          )}
                        </div>
                      )}

                      <div className="max-w-[75%] space-y-1">
                        {activeConv.isGroup && !isMe && (
                          <p className="font-['Pixelify_Sans'] text-[10px] text-[#C76B94] ml-1">
                            @{msg.senderUsername}
                          </p>
                        )}
                        <div
                          className={`rounded-2xl px-3.5 py-2 font-['Pixelify_Sans'] text-sm leading-snug ${
                            isMe ? 'chat-bubble-me rounded-br-xs' : 'chat-bubble-them text-[#F20B83] rounded-bl-xs'
                          }`}
                        >
                          {msg.media && (
                            <div className="mb-1.5">
                              <MediaRenderer
                                item={msg.media}
                                alt="Message attachment"
                                className="rounded-xl max-h-52 object-cover"
                              />
                            </div>
                          )}
                          {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                        </div>

                        <div className={`flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <button
                            type="button"
                            onClick={() => toggleHeartReaction(msg.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-['VT323'] border cursor-pointer transition-colors ${
                              iReacted || heartCount > 0
                                ? 'bg-[#FFF0F5] border-[#F20B83] text-[#F20B83]'
                                : 'bg-white/70 border-[#FFB6D5] text-[#C76B94] hover:border-[#F20B83]'
                            }`}
                          >
                            <Heart className={`w-3 h-3 ${iReacted ? 'fill-[#F20B83]' : ''}`} />
                            {heartCount > 0 && <span>{heartCount}</span>}
                          </button>
                        </div>
                      </div>

                      {!isMe && (
                        <span className="font-['VT323'] text-sm text-[#C76B94] shrink-0">
                          {formatPixelTime(msg.createdAt)}
                        </span>
                      )}
                    </div>
                  );
                })}

                {someoneTyping && (
                  <div className="font-['VT323'] text-base text-[#F20B83] px-2">
                    typing a message... ♥
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Bar */}
              <form
                onSubmit={handleSend}
                className="p-3 bg-[#FFF0F5] border-t-2 border-[#FF69AD] flex items-center gap-2"
              >
                <label
                  title="Attach photo or video"
                  className="chrome-btn w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4 text-[#F20B83]" />
                  <input type="file" accept="image/*,video/*" onChange={handleAttachment} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={toggleVoiceMessage}
                  title={recordingVoice ? 'Stop & send voice note' : 'Record voice message'}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer ${
                    recordingVoice ? 'glossy-btn' : 'chrome-btn text-[#F20B83]'
                  }`}
                >
                  {recordingVoice ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 rounded-xl border-2 border-[#FF69AD] bg-white px-3 py-2 text-sm text-[#3D1329] focus:outline-none focus:border-[#F20B83]"
                />

                <GlossyButton type="submit" disabled={sending || !draft.trim()} className="px-3.5 py-2 rounded-xl">
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </GlossyButton>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
