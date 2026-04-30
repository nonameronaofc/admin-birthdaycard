'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
  images: { id: string; image_url: string; position: number }[];
  themeName: string;
  isSelected: boolean;
  onClick: () => void;
  selectedLabel?: string;
  noImageLabel?: string;
  previewLabel?: string;
};

const HOLD_MS = 1000;        // touch & hold 1 detik untuk start playing
const SLIDE_DURATION = 2000; // jeda 2 detik per slide

export default function ThemeSlideshow({
  images,
  themeName,
  isSelected,
  onClick,
  selectedLabel = 'Dipilih',
  noImageLabel = 'Belum ada gambar',
  previewLabel = 'Tekan untuk preview',
}: Props) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [direction] = useState<'left'>('left');

  // Buat fallback minimal 1 image
  const slides = images.length > 0 ? images.slice(0, 3) : [];

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHoldingRef = useRef(false);
  const startedPlayingRef = useRef(false);

  const stopPlaying = useCallback(() => {
    setPlaying(false);
    startedPlayingRef.current = false;
    if (slideTimerRef.current) {
      clearInterval(slideTimerRef.current);
      slideTimerRef.current = null;
    }
    // reset balik ke slide 1 (sesuai requirement: kalau ga disentuh diam di gambar 1)
    setActive(0);
  }, []);

  const startPlaying = useCallback(() => {
    if (startedPlayingRef.current) return;
    startedPlayingRef.current = true;
    setPlaying(true);
    if (slides.length <= 1) return;
    slideTimerRef.current = setInterval(() => {
      setActive((cur) => (cur + 1) % slides.length);
    }, SLIDE_DURATION);
  }, [slides.length]);

  const onPressStart = useCallback(() => {
    if (slides.length <= 1) return;
    isHoldingRef.current = true;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        startPlaying();
      }
    }, HOLD_MS);
  }, [slides.length, startPlaying]);

  const onPressEnd = useCallback(() => {
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    stopPlaying();
  }, [stopPlaying]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, []);

  return (
    <div
      className={[
        'relative rounded-[22px] border-[2.5px] bg-paper overflow-hidden cursor-pointer transition-all',
        isSelected
          ? 'border-accent shadow-[0_0_0_4px_rgba(139,145,232,0.18),0_8px_24px_-8px_rgba(90,98,204,0.3)]'
          : 'border-line hover:border-accent hover:-translate-y-0.5',
      ].join(' ')}
      onClick={onClick}
      onTouchStart={onPressStart}
      onTouchEnd={onPressEnd}
      onTouchCancel={onPressEnd}
      onMouseDown={onPressStart}
      onMouseUp={onPressEnd}
      onMouseLeave={onPressEnd}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {isSelected && (
        <span className="absolute top-2 left-2 z-10 bg-accent text-white text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide">
          ✓ {selectedLabel}
        </span>
      )}

      <div className="relative w-full bg-gradient-to-br from-accent-soft to-bg-alt overflow-hidden" style={{ aspectRatio: '9 / 16' }}>
        {slides.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-ink-faint text-sm">
            {noImageLabel}
          </div>
        ) : (
          slides.map((img, i) => {
            const isActive = i === active;
            // Animasi: gambar yang aktif di center (translateX 0).
            // Gambar yang baru saja keluar geser ke kiri penuh (-100%).
            // Gambar yang akan masuk berikutnya berada di kanan (+100%, hidden).
            // Kombinasi opacity + translateX = fade-out-slide-left → fade-in-slide-from-right.
            const prevIdx = (active - 1 + slides.length) % slides.length;
            let xClass = '';
            if (isActive) xClass = 'translate-x-0 opacity-100';
            else if (i === prevIdx) xClass = '-translate-x-full opacity-0';
            else xClass = 'translate-x-full opacity-0';

            return (
              <div
                key={img.id}
                className={[
                  'absolute inset-0 transition-all ease-in-out',
                  xClass,
                ].join(' ')}
                style={{ transitionDuration: '700ms' }}
              >
                <img
                  src={img.image_url}
                  alt={`${themeName} - slide ${i + 1}`}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            );
          })
        )}

        {/* Hold hint indicator */}
        {!playing && slides.length > 1 && (
          <div className="absolute bottom-1.5 right-2 bg-black/40 backdrop-blur text-white text-[9px] font-medium px-2 py-1 rounded-full pointer-events-none flex items-center gap-1">
            <span>👆</span>
            <span>{previewLabel}</span>
          </div>
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {slides.map((_, i) => (
              <span
                key={i}
                className={[
                  'h-[5px] rounded-full transition-all duration-300',
                  i === active ? 'bg-white w-3.5' : 'bg-white/50 w-[5px]',
                ].join(' ')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
