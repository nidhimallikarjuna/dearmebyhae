import React, { useEffect, useState } from 'react';
import { Camera, Film, Globe, Lock, Plus, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, apiUpload } from '../api';
import type { PostItem, UserSelf } from '../types';
import {
  ChromeButton,
  FilmstripGallery,
  GlossyButton,
  MediaRenderer,
  PearlPanel,
  SectionHeader,
  formatShortDate,
} from '../components/RetroUI';

const DIGICAM_IMG = '/src/assets/images/y2k_digicam_graphic_1795533103095.jpg';

export function MyLittleLife({ user }: { user: UserSelf }) {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState('sparkly');
  const [postType, setPostType] = useState<'photo' | 'photodump' | 'vlog' | 'moment'>('photo');
  const [visibility, setVisibility] = useState<'private' | 'friends'>(user.privacyDefault || 'private');
  const [memoryDate, setMemoryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Retro handheld delete confirmation modal (inspired by Screenshot 2)
  const [deleteTarget, setDeleteTarget] = useState<PostItem | null>(null);
  const [selectedVlog, setSelectedVlog] = useState<PostItem | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ posts: PostItem[] }>('/api/posts');
      setPosts(res.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      let mediaIds: string[] = [];
      if (files.length > 0) {
        const uploaded = await apiUpload(files, 'post');
        mediaIds = uploaded.map((m) => m.id);
      }
      await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          caption,
          mood,
          postType: files.length > 1 ? 'photodump' : postType,
          visibility,
          memoryDate,
          mediaIds,
        }),
      });
      setTitle('');
      setCaption('');
      setFiles([]);
      setShowComposer(false);
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleVisibility = async (post: PostItem) => {
    const next = post.visibility === 'private' ? 'friends' : 'private';
    await apiFetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility: next }),
    });
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, visibility: next } : p)));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await apiFetch(`/api/posts/${deleteTarget.id}`, { method: 'DELETE' });
    setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const filmstripItems = posts
    .flatMap((p) =>
      p.media
        .filter((m) => m.kind === 'image')
        .map((m) => ({ id: p.id, url: m.url, label: `${p.title} · ${formatShortDate(p.memoryDate)}` }))
    )
    .slice(0, 12);

  return (
    <div className="space-y-5">
      <SectionHeader
        pixelTag="DIGITAL CAMERA LOGBOOK · PRIVATE BY DEFAULT"
        title="My Little Life"
        subtitle="Polaroids, photo dumps, vlogs, and personal visual blog pages."
        illustrationUrl={DIGICAM_IMG}
        rightAction={
          <GlossyButton onClick={() => setShowComposer((v) => !v)}>
            {showComposer ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showComposer ? 'Close Editor' : 'New Entry'}
          </GlossyButton>
        }
      />

      {error && (
        <div className="rounded-xl bg-[#FFE3EF] border border-[#F20B83] px-4 py-2.5 text-xs text-[#A30554]">
          {error}
        </div>
      )}

      {showComposer && (
        <PearlPanel title="UPLOAD PHOTO, DUMP OR VLOG">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Strawberry latte afternoon"
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
                />
              </div>
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Memory Date</label>
                <input
                  type="date"
                  value={memoryDate}
                  onChange={(e) => setMemoryDate(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
                />
              </div>
            </div>

            <div>
              <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Caption / Diary Entry</label>
              <textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write what happened today..."
                className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#F20B83]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Format</label>
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as typeof postType)}
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
                >
                  <option value="photo">Polaroid Photo</option>
                  <option value="photodump">Photo Dump</option>
                  <option value="vlog">Retro Vlog</option>
                  <option value="moment">Daily Moment</option>
                </select>
              </div>
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Mood Label</label>
                <input
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="sparkly"
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
                />
              </div>
              <div>
                <label className="block font-['Pixelify_Sans'] text-xs text-[#7D1B4D] mb-1">Privacy</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'private' | 'friends')}
                  className="w-full rounded-xl border-2 border-[#FFB6D5] bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#F20B83]"
                >
                  <option value="private">Private (Only Me)</option>
                  <option value="friends">Share with Friends</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border-2 border-dashed border-[#FF69AD] bg-[#FFF0F5] p-3.5">
              <label className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer">
                <span className="inline-flex items-center gap-2 font-['Pixelify_Sans'] text-xs text-[#F20B83]">
                  <Upload className="w-4 h-4" />
                  Select photos or videos (up to 10 files)
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="text-xs text-[#7D1B4D]"
                />
              </label>
              {files.length > 0 && (
                <p className="font-['VT323'] text-base text-[#7D1B4D] mt-1">
                  {files.length} file(s) ready: {files.map((f) => f.name).join(', ')}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <ChromeButton type="button" onClick={() => setShowComposer(false)}>
                Cancel
              </ChromeButton>
              <GlossyButton type="submit" disabled={submitting}>
                <Camera className="w-4 h-4" />
                {submitting ? 'Developing Film...' : 'Save to My Little Life'}
              </GlossyButton>
            </div>
          </form>
        </PearlPanel>
      )}

      {/* Filmstrip Gallery */}
      {filmstripItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-['Pixelify_Sans'] text-xs text-[#F20B83] px-1">RECENT FILMSTRIP ROLL</p>
          <FilmstripGallery items={filmstripItems} />
        </div>
      )}

      {/* Polaroid & Vlog Masonry Gallery */}
      {loading ? (
        <PearlPanel>
          <p className="text-center py-8 font-['Pixelify_Sans'] text-sm text-[#C76B94]">
            Developing your film roll...
          </p>
        </PearlPanel>
      ) : posts.length === 0 ? (
        <PearlPanel>
          <div className="text-center py-10 space-y-3">
            <img src={DIGICAM_IMG} alt="Digital camera" className="w-28 h-20 object-cover mx-auto rounded-xl border border-[#FFB6D5]" />
            <h3 className="font-['Pixelify_Sans'] text-lg font-bold text-[#F20B83]">No memories yet</h3>
            <p className="text-xs text-[#7D1B4D] max-w-md mx-auto">
              Upload your first polaroid, multi-photo dump, or retro vlog. Everything is private unless you choose to share it with friends.
            </p>
            <GlossyButton onClick={() => setShowComposer(true)}>
              <Plus className="w-4 h-4" /> Create First Memory
            </GlossyButton>
          </div>
        </PearlPanel>
      ) : (
        <div className="columns-1 sm:columns-2 gap-4 space-y-4">
          {posts.map((post) => {
            const hasVideo = post.media.some((m) => m.kind === 'video');
            return (
              <article
                key={post.id}
                className="break-inside-avoid pearl-frame rounded-2xl p-3 bg-white hover:-translate-y-0.5 transition-transform"
              >
                {/* Retro Polaroid / Handheld Media Frame */}
                {post.media.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {post.media.length === 1 ? (
                      <div className="relative rounded-xl overflow-hidden border-2 border-[#FFB6D5] bg-[#FFF0F5]">
                        <MediaRenderer item={post.media[0]} alt={post.title} className="w-full max-h-80 object-cover" />
                        {hasVideo && (
                          <button
                            type="button"
                            onClick={() => setSelectedVlog(post)}
                            className="mt-1 w-full glossy-pink-bar py-1 text-white font-['Pixelify_Sans'] text-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Film className="w-3.5 h-3.5" /> Open Retro Video Player
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
                        {post.media.slice(0, 4).map((m) => (
                          <MediaRenderer
                            key={m.id}
                            item={m}
                            alt={post.title}
                            className="w-full aspect-square object-cover rounded-lg border border-[#FFB6D5]"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-['Pixelify_Sans'] font-bold text-base text-[#3D1329] leading-snug">
                      {post.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#C76B94] mt-0.5">
                      <span className="font-['VT323'] text-base">{formatShortDate(post.memoryDate)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-['Pixelify_Sans'] text-[11px]">{post.mood}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleVisibility(post)}
                      title={post.visibility === 'private' ? 'Private (click to share with friends)' : 'Shared with friends (click to make private)'}
                      className="chrome-btn rounded-full px-2.5 py-1 text-[11px] inline-flex items-center gap-1 cursor-pointer"
                    >
                      {post.visibility === 'private' ? (
                        <>
                          <Lock className="w-3 h-3 text-[#F20B83]" /> Private
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3 text-[#F20B83]" /> Friends
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(post)}
                      aria-label="Delete memory"
                      className="chrome-btn rounded-full p-1.5 text-[#C76B94] hover:text-[#F20B83] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {post.caption && (
                  <p className="text-xs sm:text-sm text-[#7D1B4D] leading-relaxed mt-2 whitespace-pre-line">
                    {post.caption}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Retro Pink Handheld Video Player Modal */}
      {selectedVlog && (
        <div className="fixed inset-0 z-50 bg-[#3D1329]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-gradient-to-b from-[#FF69AD] to-[#F20B83] p-4 border-4 border-white shadow-2xl">
            <div className="flex items-center justify-between text-white mb-2 px-1">
              <span className="font-['Pixelify_Sans'] text-sm font-bold truncate">{selectedVlog.title}</span>
              <button
                type="button"
                onClick={() => setSelectedVlog(null)}
                className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black border-2 border-white">
              {selectedVlog.media.find((m) => m.kind === 'video') && (
                <video
                  src={selectedVlog.media.find((m) => m.kind === 'video')!.url}
                  controls
                  autoPlay
                  className="w-full max-h-[65vh]"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Retro Digital Camera Delete Confirmation (inspired by Screenshot 2) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-[#3D1329]/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-[28px] bg-[#FFB6D5] p-4 border-4 border-white shadow-2xl">
            <div className="rounded-2xl bg-white border-2 border-[#FF69AD] overflow-hidden">
              <div className="glossy-pink-bar px-3 py-1.5 text-center font-['VT323'] text-lg text-white tracking-wider">
                ARE YOU SURE MOVE TO TRASH?
              </div>
              <div className="p-4 text-center space-y-3">
                <p className="font-['Pixelify_Sans'] font-bold text-sm text-[#3D1329] truncate">
                  {deleteTarget.title}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="chrome-btn rounded-xl py-2 font-['Pixelify_Sans'] text-xs font-bold cursor-pointer"
                  >
                    ✕ CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="glossy-btn rounded-xl py-2 font-['Pixelify_Sans'] text-xs font-bold cursor-pointer"
                  >
                    ✓ DELETE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
