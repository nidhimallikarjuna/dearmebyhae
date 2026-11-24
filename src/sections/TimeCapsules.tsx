import React, { useEffect, useState } from 'react';
import { Hourglass, Lock, Plus, Sparkles, Trash2, Unlock, Upload, X } from 'lucide-react';
import { apiFetch, apiUpload } from '../api';
import type { CapsuleItem } from '../types';
import {
  ChromeButton,
  GlossyButton,
  MediaRenderer,
  PearlPanel,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

function useCountdown(targetIso: string, active: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const diff = Math.max(0, new Date(targetIso).getTime() - now);
  if (diff === 0) return '00d 00h 00m 00s';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(
    2,
    '0'
  )}m ${String(secs).padStart(2, '0')}s`;
}

function CapsuleCard({
  capsule,
  onDelete,
  onOpen,
}: {
  capsule: CapsuleItem;
  onDelete: (id: string) => void;
  onOpen: (capsule: CapsuleItem) => void;
}) {
  const countdown = useCountdown(capsule.unlockAt, capsule.isLocked);

  return (
    <div className="pearl-frame rounded-2xl overflow-hidden bg-gradient-to-b from-white to-[#FFF0F5]">
      <div className="glossy-pink-bar px-4 py-2 flex items-center justify-between">
        <span className="font-['Pixelify_Sans'] text-xs text-white flex items-center gap-1.5 truncate">
          {capsule.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {capsule.title}
        </span>
        <button
          type="button"
          onClick={() => onDelete(capsule.id)}
          className="text-white/90 hover:text-white cursor-pointer"
          aria-label="Delete capsule"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 text-center space-y-3">
        {capsule.isLocked ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-[#FFF0F5] border-2 border-[#FF69AD] mx-auto flex items-center justify-center animate-float">
              <Hourglass className="w-8 h-8 text-[#F20B83]" />
            </div>
            <div className="bg-[#3D1329] text-[#FF99C8] rounded-xl py-2 px-3 font-['VT323'] text-2xl tracking-wider tabular-nums">
              {countdown}
            </div>
            <p className="text-xs text-[#7D1B4D]">
              Unlocks on {formatShortDate(capsule.unlockAt)} · {capsule.mediaCount} sealed attachment(s)
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF85BE] to-[#F20B83] text-white mx-auto flex items-center justify-center shadow">
              <Sparkles className="w-8 h-8" />
            </div>
            <p className="font-['Pixelify_Sans'] text-sm font-bold text-[#F20B83]">
              Capsule Ready to Open!
            </p>
            <GlossyButton onClick={() => onOpen(capsule)} className="w-full">
              <Unlock className="w-4 h-4" /> Open Memory Vault
            </GlossyButton>
          </>
        )}
      </div>
    </div>
  );
}

export function TimeCapsules() {
  const [capsules, setCapsules] = useState<CapsuleItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [openedCapsule, setOpenedCapsule] = useState<CapsuleItem | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [unlockAt, setUnlockAt] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCapsules = async () => {
    const res = await apiFetch<{ capsules: CapsuleItem[] }>('/api/capsules');
    setCapsules(res.capsules);
  };

  useEffect(() => {
    void loadCapsules();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let mediaIds: string[] = [];
      if (files.length > 0) {
        const uploaded = await apiUpload(files, 'capsule');
        mediaIds = uploaded.map((m) => m.id);
      }
      await apiFetch('/api/capsules', {
        method: 'POST',
        body: JSON.stringify({ title, message, unlockAt, mediaIds }),
      });
      setTitle('');
      setMessage('');
      setFiles([]);
      setShowCreate(false);
      await loadCapsules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock capsule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/capsules/${id}`, { method: 'DELETE' });
    setCapsules((prev) => prev.filter((c) => c.id !== id));
    if (openedCapsule?.id === id) setOpenedCapsule(null);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag="PRIVATE LOCKBOXES & DIGITAL COUNTDOWNS"
        title="Time Capsules"
        subtitle="Lock away photos, videos, voice notes, and letters for your future self."
        rightAction={
          <GlossyButton onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreate ? 'Close' : 'Create Capsule'}
          </GlossyButton>
        }
      />

      {error && (
        <div className="rounded-xl bg-[#FFE3EF] border border-[#F20B83] px-4 py-2 text-xs text-[#A30554]">
          {error}
        </div>
      )}

      {showCreate && (
        <PearlPanel title="SEAL A NEW TIME CAPSULE" rightSlot={<Lock className="w-3.5 h-3.5 text-white" />}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Capsule Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summer 2026 Memories"
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
                />
              </div>
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">
                  Unlock Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={unlockAt}
                  onChange={(e) => setUnlockAt(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
                />
              </div>
            </div>

            <div>
              <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Message Inside</label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write something you want to remember when this opens..."
                className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
              />
            </div>

            <div className="rounded-xl border-2 border-dashed border-[#FF69AD] bg-[#FFF0F5] p-3">
              <label className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer">
                <span className="inline-flex items-center gap-2 font-['Pixelify_Sans'] text-xs text-[#F20B83]">
                  <Upload className="w-4 h-4" />
                  Add photos, videos, or audio notes
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="text-xs text-[#7D1B4D]"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <ChromeButton type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </ChromeButton>
              <GlossyButton type="submit" disabled={saving}>
                <Lock className="w-4 h-4" />
                {saving ? 'Locking Capsule...' : 'Lock Capsule'}
              </GlossyButton>
            </div>
          </form>
        </PearlPanel>
      )}

      {openedCapsule && (
        <PearlPanel
          title={`UNLOCKED CAPSULE · ${openedCapsule.title.toUpperCase()}`}
          rightSlot={
            <button
              type="button"
              onClick={() => setOpenedCapsule(null)}
              className="text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          }
        >
          <div className="space-y-4">
            {openedCapsule.message && (
              <p className="font-['Serif'] text-base text-[#3D1329] bg-[#FFF0F5] border border-[#FFB6D5] rounded-2xl p-4 whitespace-pre-line">
                {openedCapsule.message}
              </p>
            )}
            {openedCapsule.media.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {openedCapsule.media.map((m) => (
                  <MediaRenderer
                    key={m.id}
                    item={m}
                    alt={openedCapsule.title}
                    className="w-full rounded-xl border-2 border-[#FFB6D5] max-h-72 object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        </PearlPanel>
      )}

      {capsules.length === 0 ? (
        <PearlPanel>
          <div className="text-center py-8 space-y-2">
            <Hourglass className="w-9 h-9 mx-auto text-[#FF69AD]" />
            <p className="font-['Pixelify_Sans'] text-sm text-[#C76B94]">
              No time capsules yet. Seal photos, audio, and memories for next year!
            </p>
          </div>
        </PearlPanel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {capsules.map((c) => (
            <CapsuleCard key={c.id} capsule={c} onDelete={handleDelete} onOpen={setOpenedCapsule} />
          ))}
        </div>
      )}
    </div>
  );
}
