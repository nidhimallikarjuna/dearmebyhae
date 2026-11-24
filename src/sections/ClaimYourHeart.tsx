import React, { useEffect, useState } from 'react';
import { Download, Heart, Sparkles } from 'lucide-react';
import { apiFetch } from '../api';
import type { HeartClaim } from '../types';
import {
  ChromeButton,
  GlossyButton,
  PearlPanel,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

export function ClaimYourHeart({ onClaimed }: { onClaimed?: () => void }) {
  const [todayClaim, setTodayClaim] = useState<HeartClaim | null>(null);
  const [archive, setArchive] = useState<HeartClaim[]>([]);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadClaims = async () => {
    const res = await apiFetch<{
      todayClaim: HeartClaim | null;
      archive: HeartClaim[];
      totalClaimed: number;
    }>('/api/heart-claims');
    setTodayClaim(res.todayClaim);
    setArchive(res.archive);
    setTotalClaimed(res.totalClaimed);
  };

  useEffect(() => {
    void loadClaims();
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await apiFetch<{ claim: HeartClaim; alreadyClaimed: boolean }>('/api/heart-claims/claim', {
        method: 'POST',
      });
      setTodayClaim(res.claim);
      setJustRevealed(true);
      await loadClaims();
      onClaimed?.();
    } finally {
      setClaiming(false);
    }
  };

  const toggleFavorite = async (id: string) => {
    const res = await apiFetch<{ isFavorite: boolean }>(`/api/heart-claims/${id}/favorite`, {
      method: 'PATCH',
    });
    setArchive((prev) => prev.map((c) => (c.id === id ? { ...c, isFavorite: res.isFavorite } : c)));
    if (todayClaim?.id === id) {
      setTodayClaim({ ...todayClaim, isFavorite: res.isFavorite });
    }
  };

  const downloadQuoteCard = (claim: HeartClaim) => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 960, 640);
    grad.addColorStop(0, '#FFF0F5');
    grad.addColorStop(0.5, '#F8D8E6');
    grad.addColorStop(1, '#FFB6D5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 640);

    ctx.strokeStyle = '#F20B83';
    ctx.lineWidth = 8;
    ctx.strokeRect(32, 32, 896, 576);

    ctx.fillStyle = '#F20B83';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('dear, me. ♥ daily heart', 480, 108);

    ctx.fillStyle = '#3D1329';
    ctx.font = 'italic 36px Georgia, serif';
    const words = `“${claim.quoteText}”`.split(' ');
    let line = '';
    let y = 240;
    for (const w of words) {
      const test = `${line}${w} `;
      if (ctx.measureText(test).width > 740) {
        ctx.fillText(line.trim(), 480, y);
        line = `${w} `;
        y += 50;
      } else {
        line = test;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), 480, y);

    ctx.fillStyle = '#C76B94';
    ctx.font = '24px monospace';
    ctx.fillText(`— ${claim.quoteAuthor} · ${claim.claimDate}`, 480, 540);

    const link = document.createElement('a');
    link.download = `dear-me-heart-${claim.claimDate}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const progressPct = Math.min(100, Math.round((totalClaimed / 365) * 100));

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag="365-DAY DAILY HEART RITUAL"
        title="Claim Your Heart"
        subtitle="One unique daily quote to collect, favourite, and keep in your pink archive."
      />

      {/* 365-Day Progress Bar */}
      <PearlPanel title="365-DAY HEART COLLECTION PROGRESS">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-['Pixelify_Sans'] font-bold text-[#F20B83]">
            {totalClaimed} of 365 Hearts Claimed
          </span>
          <span className="font-['VT323'] text-lg text-[#C76B94] tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-4 rounded-full bg-[#FFF0F5] border-2 border-[#FFB6D5] overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF69AD] to-[#F20B83] transition-all duration-500"
            style={{ width: `${Math.max(2, progressPct)}%` }}
          />
        </div>
      </PearlPanel>

      {/* Main Heart Claim Experience */}
      <PearlPanel>
        <div className="py-6 px-3 text-center space-y-5 bg-gradient-to-b from-[#FFF0F5] to-white rounded-xl border border-[#F8D8E6]">
          <div className="relative inline-flex items-center justify-center">
            <button
              type="button"
              onClick={todayClaim ? undefined : handleClaim}
              disabled={claiming || Boolean(todayClaim)}
              className={`w-36 h-36 rounded-full flex items-center justify-center transition-transform ${
                todayClaim
                  ? 'bg-gradient-to-b from-[#FF85BE] to-[#F20B83] shadow-lg'
                  : 'bg-gradient-to-b from-[#FF99C8] to-[#F20B83] shadow-xl hover:scale-105 cursor-pointer animate-float'
              }`}
              aria-label="Claim today's heart"
            >
              <Heart className="w-20 h-20 text-white fill-white drop-shadow" />
            </button>
          </div>

          {!todayClaim ? (
            <div className="space-y-3 max-w-md mx-auto">
              <h2 className="font-['Pixelify_Sans'] text-xl font-bold text-[#F20B83]">
                Today&apos;s Heart is Ready to Open
              </h2>
              <p className="text-xs sm:text-sm text-[#7D1B4D]">
                Tap the glossy heart to unlock today&apos;s unique note for your soul.
              </p>
              <GlossyButton onClick={handleClaim} disabled={claiming} className="px-6 py-2.5 text-sm">
                <Sparkles className="w-4 h-4" />
                {claiming ? 'Claiming Heart...' : "Claim Today's Heart"}
              </GlossyButton>
            </div>
          ) : (
            <div
              className={`max-w-xl mx-auto space-y-4 transition-all duration-500 ${
                justRevealed ? 'scale-100 opacity-100' : ''
              }`}
            >
              <div className="font-['VT323'] text-lg text-[#C76B94]">
                CLAIMED ON {formatShortDate(todayClaim.claimDate).toUpperCase()}
              </div>
              <blockquote className="font-['Serif'] italic text-xl sm:text-2xl text-[#3D1329] leading-relaxed">
                “{todayClaim.quoteText}”
              </blockquote>
              <p className="font-['Pixelify_Sans'] text-sm text-[#F20B83]">— {todayClaim.quoteAuthor}</p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <GlossyButton onClick={() => toggleFavorite(todayClaim.id)}>
                  <Heart className={`w-4 h-4 ${todayClaim.isFavorite ? 'fill-white' : ''}`} />
                  {todayClaim.isFavorite ? 'Favourited' : 'Save Favourite'}
                </GlossyButton>
                <ChromeButton onClick={() => downloadQuoteCard(todayClaim)}>
                  <Download className="w-3.5 h-3.5" /> Save Pink Card
                </ChromeButton>
                <ChromeButton
                  onClick={() => {
                    navigator.clipboard?.writeText(`“${todayClaim.quoteText}” — ${todayClaim.quoteAuthor}`);
                    setCopiedId(todayClaim.id);
                    setTimeout(() => setCopiedId(null), 1500);
                  }}
                >
                  {copiedId === todayClaim.id ? 'Copied!' : 'Copy Quote'}
                </ChromeButton>
              </div>
            </div>
          )}
        </div>
      </PearlPanel>

      {/* Past Quote Archive */}
      <PearlPanel title="PAST HEART QUOTE ARCHIVE">
        {archive.length === 0 ? (
          <p className="text-center py-6 font-['Pixelify_Sans'] text-xs text-[#C76B94]">
            Claim your first daily heart above to start your 365-day quote archive!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {archive.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border-2 border-[#FFB6D5] bg-[#FFF8FB] p-3.5 flex flex-col justify-between gap-2"
              >
                <p className="font-['Serif'] italic text-sm text-[#3D1329] leading-relaxed">
                  “{item.quoteText}”
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-dotted border-[#FFB6D5]">
                  <span className="font-['VT323'] text-base text-[#C76B94]">
                    {formatShortDate(item.claimDate)} · {item.quoteAuthor}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => downloadQuoteCard(item)}
                      className="chrome-btn rounded-full p-1.5 cursor-pointer"
                      aria-label="Download quote card"
                    >
                      <Download className="w-3.5 h-3.5 text-[#7D1B4D]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(item.id)}
                      className="chrome-btn rounded-full p-1.5 cursor-pointer"
                      aria-label="Toggle favourite"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          item.isFavorite ? 'fill-[#F20B83] text-[#F20B83]' : 'text-[#C76B94]'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PearlPanel>
    </div>
  );
}
