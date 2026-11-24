import React, { useEffect, useState } from 'react';
import { CalendarHeart, Sparkles } from 'lucide-react';
import { apiFetch } from '../api';
import type { PostItem } from '../types';
import {
  FilmstripGallery,
  MediaRenderer,
  PearlPanel,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

export function OnThisDay() {
  const [items, setItems] = useState<PostItem[]>([]);
  const [archive, setArchive] = useState<PostItem[]>([]);
  const [today, setToday] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await apiFetch<{ today: string; items: PostItem[]; archive: PostItem[] }>('/api/on-this-day');
      setToday(res.today);
      setItems(res.items);
      setArchive(res.archive);
    })();
  }, []);

  const milestones = [1, 2, 3, 5];

  const filmstripPhotos = archive
    .flatMap((p) =>
      p.media
        .filter((m) => m.kind === 'image')
        .map((m) => ({ id: p.id, url: m.url, label: `${p.memoryDate} · ${p.title}` }))
    )
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag={`NOSTALGIA MEMORY LANE · ${today || 'TODAY'}`}
        title="On This Day"
        subtitle="Flashbacks from 1, 2, 3, and 5 years ago today."
      />

      {/* Milestone Year Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {milestones.map((yr) => {
          const matches = items.filter((i) => i.yearsAgo === yr);
          return (
            <PearlPanel
              key={yr}
              title={`${yr} ${yr === 1 ? 'YEAR' : 'YEARS'} AGO TODAY`}
            >
              {matches.length === 0 ? (
                <div className="py-5 text-center space-y-1.5">
                  <CalendarHeart className="w-7 h-7 mx-auto text-[#FFB6D5]" />
                  <p className="font-['Pixelify_Sans'] text-xs text-[#C76B94]">
                    No diary entry dated {yr} {yr === 1 ? 'year' : 'years'} ago today yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((mem) => (
                    <div key={mem.id} className="rounded-xl border-2 border-[#FFB6D5] bg-[#FFF8FB] p-3 space-y-2">
                      {mem.media[0] && (
                        <MediaRenderer
                          item={mem.media[0]}
                          alt={mem.title}
                          className="w-full h-44 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-['Pixelify_Sans'] font-bold text-[#F20B83]">{mem.title}</span>
                        <span className="font-['VT323'] text-base text-[#C76B94]">
                          {formatShortDate(mem.memoryDate)}
                        </span>
                      </div>
                      {mem.caption && <p className="text-xs text-[#7D1B4D]">{mem.caption}</p>}
                    </div>
                  ))}
                </div>
              )}
            </PearlPanel>
          );
        })}
      </div>

      {/* Filmstrip of Past Years */}
      {filmstripPhotos.length > 0 && (
        <div className="space-y-2">
          <p className="font-['Pixelify_Sans'] text-xs text-[#F20B83]">PAST YEARS FILMSTRIP</p>
          <FilmstripGallery items={filmstripPhotos} />
        </div>
      )}

      {/* Full Past-Year Nostalgic Polaroids */}
      {archive.length > 0 && (
        <PearlPanel title="ALL PAST-YEAR MEMORIES">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archive.map((mem) => (
              <div key={mem.id} className="bg-white border-2 border-[#FFB6D5] rounded-xl p-2.5 shadow-sm">
                {mem.media[0] ? (
                  <MediaRenderer
                    item={mem.media[0]}
                    alt={mem.title}
                    className="w-full aspect-[4/3] rounded-lg object-cover mb-2"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] rounded-lg bg-[#FFF0F5] flex items-center justify-center mb-2">
                    <Sparkles className="w-6 h-6 text-[#FF69AD]" />
                  </div>
                )}
                <p className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">{mem.title}</p>
                <p className="font-['VT323'] text-base text-[#C76B94]">
                  {formatShortDate(mem.memoryDate)} ({mem.yearsAgo}y ago)
                </p>
              </div>
            ))}
          </div>
        </PearlPanel>
      )}
    </div>
  );
}
