import React, { useEffect, useState } from 'react';
import { ExternalLink, Lock, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, apiUpload } from '../api';
import type { LoveItem } from '../types';
import {
  ChromeButton,
  GlossyButton,
  PearlPanel,
  ResilientImage,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

const CATEGORIES = [
  'All',
  'Fashion',
  'Music',
  'Movies',
  'Food',
  'Quotes',
  'Books & Places',
  'Custom',
];

export function ThingsILove() {
  const [items, setItems] = useState<LoveItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showAdd, setShowAdd] = useState(false);

  const [category, setCategory] = useState('Fashion');
  const [collectionName, setCollectionName] = useState('Coquette Moodboard');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadItems = async () => {
    try {
      const res = await apiFetch<{ items: LoveItem[] }>('/api/love-items');
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection.');
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let mediaId = '';
      if (file) {
        const uploaded = await apiUpload([file], 'love');
        mediaId = uploaded[0].id;
      }
      await apiFetch('/api/love-items', {
        method: 'POST',
        body: JSON.stringify({
          category,
          collectionName,
          title,
          note,
          linkUrl,
          mediaId,
        }),
      });
      setTitle('');
      setNote('');
      setLinkUrl('');
      setFile(null);
      setShowAdd(false);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/love-items/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const visibleItems = activeCategory === 'All' ? items : items.filter((i) => i.category === activeCategory);

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag="PRIVATE SCRAPBOOK MOODBOARDS · PINTEREST MEETS 2005"
        title="Things I Love"
        subtitle="Fashion boards, music playlists, comfort movies, cafés, quotes, and aesthetic pins."
        rightAction={
          <GlossyButton onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAdd ? 'Close' : 'Pin New Love'}
          </GlossyButton>
        }
      />

      {error && (
        <div className="rounded-xl bg-[#FFE3EF] border border-[#F20B83] px-4 py-2 text-xs text-[#A30554]">
          {error}
        </div>
      )}

      {showAdd && (
        <PearlPanel title="PIN TO YOUR SCRAPBOOK" rightSlot={<Lock className="w-3.5 h-3.5 text-white" />}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Board / Collection</label>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="Dream Wardrobe"
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Strawberry shortcake matcha"
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
                />
              </div>
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">
                  Link (optional)
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
                />
              </div>
            </div>

            <div>
              <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Scrapbook Note</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why you love this..."
                className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="chrome-btn rounded-full px-3.5 py-2 text-xs cursor-pointer inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {file ? file.name : 'Upload Aesthetic Image'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <GlossyButton type="submit" disabled={saving}>
                <Sparkles className="w-4 h-4" />
                {saving ? 'Pinning...' : 'Pin to Board'}
              </GlossyButton>
            </div>
          </form>
        </PearlPanel>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-['Pixelify_Sans'] whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
              activeCategory === cat
                ? 'glossy-pink-bar text-white border-[#B5055E]'
                : 'bg-white text-[#7D1B4D] border-[#FFB6D5] hover:border-[#F20B83]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Scrapbook Masonry Grid */}
      {visibleItems.length === 0 ? (
        <PearlPanel>
          <div className="text-center py-8 space-y-2">
            <Sparkles className="w-8 h-8 mx-auto text-[#FF69AD]" />
            <p className="font-['Pixelify_Sans'] text-sm text-[#C76B94]">
              Nothing pinned in {activeCategory} yet. Start curating your private aesthetic board!
            </p>
          </div>
        </PearlPanel>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              className="break-inside-avoid pearl-frame rounded-2xl overflow-hidden bg-white hover:-translate-y-0.5 transition-transform"
            >
              {item.imageUrl && (
                <ResilientImage src={item.imageUrl} alt={item.title} className="w-full max-h-64 object-cover" />
              )}
              <div className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#C76B94]">
                  <span className="font-['Pixelify_Sans']">{item.category} · {item.collectionName}</span>
                  <span className="font-['VT323'] text-sm">{formatShortDate(item.createdAt)}</span>
                </div>
                <h3 className="font-['Pixelify_Sans'] font-bold text-base text-[#3D1329]">{item.title}</h3>
                {item.note && <p className="text-xs text-[#7D1B4D] leading-relaxed">{item.note}</p>}
                <div className="flex items-center justify-between pt-1 border-t border-dotted border-[#FFB6D5]">
                  {item.linkUrl ? (
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-['Pixelify_Sans'] text-[#F20B83] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Link
                    </a>
                  ) : (
                    <span className="font-['VT323'] text-sm text-[#C76B94]">Private Pin</span>
                  )}
                  <ChromeButton onClick={() => handleDelete(item.id)} className="px-2 py-1">
                    <Trash2 className="w-3 h-3 text-[#F20B83]" />
                  </ChromeButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
