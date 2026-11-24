import React from 'react';
import { Heart, Sparkles } from 'lucide-react';
import type { MediaItem } from '../types';

export function GlossyButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`glossy-btn inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F20B83] ${className}`}
    >
      {children}
    </button>
  );
}

export function ChromeButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`chrome-btn inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F20B83] ${className}`}
    >
      {children}
    </button>
  );
}

export function PearlPanel({
  children,
  className = '',
  title,
  rightSlot,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <section className={`pearl-frame rounded-2xl overflow-hidden ${className}`}>
      {title && (
        <div className="glossy-pink-bar px-4 py-2.5 flex items-center justify-between gap-3">
          <h3 className="font-['Pixelify_Sans'] text-white text-sm sm:text-base tracking-wide flex items-center gap-1.5 truncate">
            <Heart className="w-3.5 h-3.5 fill-white shrink-0" />
            <span className="truncate">{title}</span>
          </h3>
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function DottedPanel({
  children,
  className = '',
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`retro-dotted-box rounded-2xl p-4 ${className}`}>
      {label && (
        <div className="glossy-pink-bar rounded-full px-3 py-1 inline-flex items-center gap-1.5 mb-3">
          <Sparkles className="w-3 h-3 text-white" />
          <span className="font-['Pixelify_Sans'] text-xs text-white tracking-wide">{label}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  pixelTag,
  illustrationUrl,
  rightAction,
}: {
  title: string;
  subtitle: string;
  pixelTag?: string;
  illustrationUrl?: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="pearl-frame rounded-2xl overflow-hidden bg-gradient-to-r from-[#FFF0F5] via-white to-[#F8D8E6]">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {illustrationUrl && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-[#FFB6D5] bg-white overflow-hidden shrink-0 shadow-sm">
              <img
                src={illustrationUrl}
                alt={title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0">
            {pixelTag && (
              <div className="font-['VT323'] text-base text-[#C76B94] tracking-wider uppercase leading-none mb-1">
                {pixelTag}
              </div>
            )}
            <h1 className="font-['Pixelify_Sans'] text-2xl sm:text-3xl font-bold text-[#F20B83] leading-tight">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-[#7D1B4D]/80 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
    </div>
  );
}

export function BowDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="h-[2px] flex-1 border-t-2 border-dotted border-[#FF69AD]" />
      <span className="font-['Pixelify_Sans'] text-xs text-[#F20B83] tracking-wider flex items-center gap-1.5">
        <span aria-hidden="true">୨ৎ</span>
        {label && <span>{label}</span>}
        <span aria-hidden="true">୨ৎ</span>
      </span>
      <div className="h-[2px] flex-1 border-t-2 border-dotted border-[#FF69AD]" />
    </div>
  );
}

export function ResilientImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F8D8E6] via-[#FFF0F5] to-[#FFB6D5] text-[#C76B94] p-4 text-center ${className}`}
      >
        <Heart className="w-6 h-6 mb-1 fill-[#FF69AD] text-[#F20B83]" />
        <span className="font-['Pixelify_Sans'] text-xs truncate max-w-full">{alt || 'dear, me.'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function MediaRenderer({
  item,
  alt,
  className = '',
}: {
  item: MediaItem;
  alt: string;
  className?: string;
}) {
  if (item.kind === 'video') {
    return (
      <div className={`relative bg-[#2A0B1B] overflow-hidden ${className}`}>
        <video
          src={item.url}
          controls
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  if (item.kind === 'audio') {
    return (
      <div className={`bg-[#FFF0F5] border border-[#FFB6D5] p-3 rounded-xl flex items-center gap-2 ${className}`}>
        <audio src={item.url} controls className="w-full h-9" />
      </div>
    );
  }
  return <ResilientImage src={item.url} alt={alt} className={className} />;
}

export function AvatarCircle({
  url,
  name,
  size = 'md',
}: {
  url?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizeClass =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
        ? 'w-14 h-14 text-lg'
        : size === 'xl'
          ? 'w-20 h-20 text-2xl'
          : 'w-10 h-10 text-sm';

  return (
    <div
      className={`${sizeClass} rounded-full border-2 border-[#FF69AD] bg-gradient-to-br from-[#FFB6D5] to-[#F20B83] text-white font-['Pixelify_Sans'] font-bold flex items-center justify-center overflow-hidden shrink-0 shadow-sm`}
    >
      {url ? (
        <ResilientImage src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{(name || '?').slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

export function FilmstripGallery({
  items,
  onSelect,
}: {
  items: Array<{ id: string; url: string; label: string }>;
  onSelect?: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="bg-gradient-to-r from-[#FF69AD] via-[#F20B83] to-[#FF69AD] rounded-2xl p-2 shadow-md border-2 border-[#FFB6D5] overflow-hidden">
      <div className="h-3.5 filmstrip-holes mb-1.5 opacity-90" />
      <div className="flex gap-3 overflow-x-auto pb-1 px-1 snap-x">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            className="group relative shrink-0 w-36 sm:w-44 aspect-[4/3] rounded-lg overflow-hidden border-2 border-white bg-[#FFF0F5] shadow hover:-translate-y-0.5 transition-transform cursor-pointer snap-start"
          >
            <ResilientImage src={item.url} alt={item.label} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#3D1329]/85 via-[#3D1329]/30 to-transparent px-2 py-1 text-left">
              <p className="font-['Pixelify_Sans'] text-[11px] text-white truncate">{item.label}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="h-3.5 filmstrip-holes mt-1.5 opacity-90" />
    </div>
  );
}

export function formatShortDate(isoOrDate: string): string {
  if (!isoOrDate) return '';
  const d = new Date(isoOrDate.length === 10 ? `${isoOrDate}T12:00:00` : isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatPixelTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
}
