import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getSessionToken, setSessionToken, wsUrl } from './api';
import { Layout } from './components/Layout';
import { LockScreen } from './components/LockScreen';
import { ClaimYourHeart } from './sections/ClaimYourHeart';
import { HomeDashboard, type DashboardData } from './sections/HomeDashboard';
import { LettersToMyself } from './sections/LettersToMyself';
import { Messaging } from './sections/Messaging';
import { MyLittleLife } from './sections/MyLittleLife';
import { MyPeople } from './sections/MyPeople';
import { OnThisDay } from './sections/OnThisDay';
import { SettingsPanel } from './sections/SettingsPanel';
import { ThingsILove } from './sections/ThingsILove';
import { TimeCapsules } from './sections/TimeCapsules';
import { VoiceDiary } from './sections/VoiceDiary';
import type { SectionKey, UserSelf } from './types';

export default function App() {
  const [user, setUser] = useState<UserSelf | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('home');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [wsEvent, setWsEvent] = useState<Record<string, unknown> | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!getSessionToken()) return;
    try {
      const data = await apiFetch<DashboardData>('/api/dashboard');
      setDashboard(data);
    } catch {
      // ignore if session expired
    }
  }, []);

  // Connect WebSocket when authenticated
  useEffect(() => {
    const token = getSessionToken();
    if (!user || !token) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const ws = new WebSocket(wsUrl('/ws'));
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        setWsEvent(parsed);
        if (parsed?.type === 'notification:new' || parsed?.type === 'message:new') {
          void loadDashboard();
        }
      } catch {
        // ignore invalid frames
      }
    };

    return () => {
      ws.close();
    };
  }, [user?.id, loadDashboard]);

  useEffect(() => {
    if (user) {
      void loadDashboard();
    }
  }, [user, activeSection, loadDashboard]);

  const handleLock = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setSessionToken('');
    wsRef.current?.close();
    setUser(null);
    setDashboard(null);
    setActiveSection('home');
  };

  const handleUpdateMood = async (mood: string) => {
    await apiFetch('/api/mood', {
      method: 'POST',
      body: JSON.stringify({ mood }),
    });
    if (user) {
      setUser({ ...user, moodToday: mood });
    }
    await loadDashboard();
  };

  const handleMarkNotificationsRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setDashboard((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
          }
        : prev
    );
  };

  const sendTyping = (conversationId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', conversationId, isTyping }));
    }
  };

  if (!user) {
    return (
      <LockScreen
        onUnlock={(unlockedUser) => {
          setUser(unlockedUser);
          setActiveSection('home');
        }}
      />
    );
  }

  return (
    <Layout
      user={user}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onLock={handleLock}
      notifications={dashboard?.notifications || []}
      unreadMessagesCount={dashboard?.unreadMessagesCount || 0}
      onMarkNotificationsRead={handleMarkNotificationsRead}
      todayClaim={dashboard?.todayClaim || null}
      onThisDayCount={dashboard?.onThisDay.length || 0}
      todayMood={dashboard?.todayMood || { mood: user.moodToday, note: '' }}
      onUpdateMood={handleUpdateMood}
    >
      {activeSection === 'home' && (
        <HomeDashboard
          user={user}
          dashboard={dashboard}
          onNavigate={setActiveSection}
          onUpdateMood={handleUpdateMood}
        />
      )}
      {activeSection === 'life' && <MyLittleLife user={user} />}
      {activeSection === 'voice' && <VoiceDiary />}
      {activeSection === 'love' && <ThingsILove />}
      {activeSection === 'heart' && <ClaimYourHeart onClaimed={loadDashboard} />}
      {activeSection === 'letters' && <LettersToMyself />}
      {activeSection === 'capsules' && <TimeCapsules />}
      {activeSection === 'onthisday' && <OnThisDay />}
      {activeSection === 'people' && (
        <MyPeople
          onOpenChat={(convId) => {
            setSelectedConversationId(convId);
            setActiveSection('messages');
          }}
        />
      )}
      {activeSection === 'messages' && (
        <Messaging
          user={user}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          wsEvent={wsEvent}
          sendTyping={sendTyping}
          onMessagesRead={loadDashboard}
        />
      )}
      {activeSection === 'settings' && (
        <SettingsPanel
          user={user}
          onUserUpdated={setUser}
          onSessionRevoked={() => {
            setSessionToken('');
            setUser(null);
          }}
        />
      )}
    </Layout>
  );
}
