import React, { useEffect, useState } from 'react';
import { Lock, Mail, MailOpen, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../api';
import type { LetterItem } from '../types';
import {
  ChromeButton,
  GlossyButton,
  PearlPanel,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

const LETTER_IMG = '/src/assets/images/y2k_wax_seal_letter_1795533103070.jpg';

const SEAL_COLORS = [
  { id: '#F20B83', label: 'Hot Pink' },
  { id: '#FF69AD', label: 'Bubblegum' },
  { id: '#C76B94', label: 'Dusty Rose' },
  { id: '#A855F7', label: 'Lavender' },
];

export function LettersToMyself() {
  const [letters, setLetters] = useState<LetterItem[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [openedLetter, setOpenedLetter] = useState<LetterItem | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sealColor, setSealColor] = useState('#F20B83');
  const [deliverOn, setDeliverOn] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadLetters = async () => {
    const res = await apiFetch<{ letters: LetterItem[] }>('/api/letters');
    setLetters(res.letters);
  };

  useEffect(() => {
    void loadLetters();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/letters', {
        method: 'POST',
        body: JSON.stringify({ title, body, sealColor, deliverOn }),
      });
      setTitle('');
      setBody('');
      setShowEditor(false);
      await loadLetters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to seal letter.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/letters/${id}`, { method: 'DELETE' });
    setLetters((prev) => prev.filter((l) => l.id !== id));
    if (openedLetter?.id === id) setOpenedLetter(null);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag="PRIVATE STATIONERY & WAX SEALS"
        title="Letters to Myself"
        subtitle="Write heartfelt pink letters sealed until their future delivery date."
        illustrationUrl={LETTER_IMG}
        rightAction={
          <GlossyButton onClick={() => setShowEditor((v) => !v)}>
            {showEditor ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showEditor ? 'Close Paper' : 'Write Letter'}
          </GlossyButton>
        }
      />

      {error && (
        <div className="rounded-xl bg-[#FFE3EF] border border-[#F20B83] px-4 py-2 text-xs text-[#A30554]">
          {error}
        </div>
      )}

      {showEditor && (
        <PearlPanel title="PINK STATIONERY EDITOR" rightSlot={<Lock className="w-3.5 h-3.5 text-white" />}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Letter Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dear future me on my birthday..."
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
                />
              </div>
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Delivery Date</label>
                <input
                  type="date"
                  required
                  value={deliverOn}
                  onChange={(e) => setDeliverOn(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
                />
              </div>
            </div>

            <div>
              <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Wax Seal Colour</label>
              <div className="flex flex-wrap gap-2">
                {SEAL_COLORS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSealColor(s.id)}
                    className={`rounded-full px-3 py-1 text-xs font-['Pixelify_Sans'] border flex items-center gap-1.5 cursor-pointer ${
                      sealColor === s.id
                        ? 'border-[#3D1329] bg-[#FFF0F5] font-bold'
                        : 'border-[#FFB6D5] bg-white'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.id }} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lined Pink Stationery Paper */}
            <div
              className="rounded-2xl border-2 border-[#FFB6D5] p-4 bg-[#FFF8FB]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(transparent, transparent 31px, rgba(255, 182, 213, 0.45) 31px, rgba(255, 182, 213, 0.45) 32px)',
              }}
            >
              <textarea
                rows={7}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Dear me, remember how this week felt..."
                className="w-full bg-transparent font-['Serif'] text-base text-[#3D1329] leading-8 focus:outline-none resize-y"
              />
            </div>

            <div className="flex justify-end gap-2">
              <ChromeButton type="button" onClick={() => setShowEditor(false)}>
                Cancel
              </ChromeButton>
              <GlossyButton type="submit" disabled={saving}>
                <Mail className="w-4 h-4" />
                {saving ? 'Sealing Envelope...' : 'Seal & Schedule'}
              </GlossyButton>
            </div>
          </form>
        </PearlPanel>
      )}

      {/* Open Letter Modal / Reading Sheet */}
      {openedLetter && (
        <PearlPanel
          title={`OPENED LETTER · ${openedLetter.title.toUpperCase()}`}
          rightSlot={
            <button
              type="button"
              onClick={() => setOpenedLetter(null)}
              className="text-white hover:opacity-80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          }
        >
          <div className="rounded-2xl border-2 border-[#FFB6D5] bg-[#FFF8FB] p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#C76B94]">
              <span className="font-['VT323'] text-base">
                Written {formatShortDate(openedLetter.createdAt)} · Delivered {formatShortDate(openedLetter.deliverOn)}
              </span>
              <span
                className="w-6 h-6 rounded-full inline-flex items-center justify-center text-white text-xs shadow"
                style={{ backgroundColor: openedLetter.sealColor }}
              >
                ♥
              </span>
            </div>
            <h3 className="font-['Serif'] text-xl font-bold text-[#F20B83]">{openedLetter.title}</h3>
            <p className="font-['Serif'] text-base text-[#3D1329] leading-relaxed whitespace-pre-line">
              {openedLetter.body}
            </p>
          </div>
        </PearlPanel>
      )}

      {/* Envelopes Collection */}
      {letters.length === 0 ? (
        <PearlPanel>
          <div className="text-center py-8 space-y-3">
            <img src={LETTER_IMG} alt="Pink wax sealed envelope" className="w-32 h-24 object-cover mx-auto rounded-xl border border-[#FFB6D5]" />
            <p className="font-['Pixelify_Sans'] text-sm text-[#C76B94]">
              No sealed letters yet. Write a love note to your future self!
            </p>
          </div>
        </PearlPanel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {letters.map((letter) => (
            <div
              key={letter.id}
              className="pearl-frame rounded-2xl p-4 bg-gradient-to-br from-[#FFF8FB] to-[#FCE2EE] relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md shrink-0 border-2 border-white"
                    style={{ backgroundColor: letter.sealColor }}
                  >
                    {letter.isLocked ? <Lock className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">
                      {letter.title}
                    </h4>
                    <p className="font-['VT323'] text-base text-[#C76B94]">
                      {letter.isLocked
                        ? `Unlocks ${formatShortDate(letter.deliverOn)}`
                        : `Delivered ${formatShortDate(letter.deliverOn)}`}
                    </p>
                  </div>
                </div>

                <ChromeButton onClick={() => handleDelete(letter.id)} className="px-2 py-1" aria-label="Delete letter">
                  <Trash2 className="w-3.5 h-3.5 text-[#F20B83]" />
                </ChromeButton>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="font-['Pixelify_Sans'] text-xs text-[#7D1B4D]">
                  {letter.isLocked ? 'Wax-sealed until delivery date' : 'Ready to open & read'}
                </span>
                {!letter.isLocked && (
                  <GlossyButton onClick={() => setOpenedLetter(letter)} className="text-xs px-3 py-1">
                    Open Envelope
                  </GlossyButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
