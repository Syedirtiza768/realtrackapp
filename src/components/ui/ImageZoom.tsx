/* ─── ImageZoom ──────────────────────────────────────────────
 *  Reusable full-screen image lightbox. Shows one image at a
 *  time from a list, supports arrow/Esc navigation, click-outside
 *  to close, and click-and-drag panning when zoomed in.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  images: string[];
  index: number;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

export default function ImageZoom({ images, index, onClose }: Props) {
  const [current, setCurrent] = useState(index);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const safeIndex = Math.min(Math.max(index, 0), Math.max(images.length - 1, 0));
  useEffect(() => setCurrent(safeIndex), [safeIndex]);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (images.length === 0) return;
      const wrapped = (next + images.length) % images.length;
      setCurrent(wrapped);
      resetView();
    },
    [images.length, resetView],
  );

  // Close + navigation keyboard handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goTo, current]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (images.length === 0) return null;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => {
      const next = z - e.deltaY * 0.0015;
      const clamped = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
      if (clamped === MIN_ZOOM) setOffset({ x: 0, y: 0 });
      return clamped;
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    setOffset({
      x: dragState.current.originX + (e.clientX - dragState.current.startX),
      y: dragState.current.originY + (e.clientY - dragState.current.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragState.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      dragState.current = null;
    }
  };

  const zoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => {
    const next = Math.max(zoom - ZOOM_STEP, MIN_ZOOM);
    if (next === MIN_ZOOM) setOffset({ x: 0, y: 0 });
    setZoom(next);
  };

  const canPan = zoom > 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X size={22} />
      </button>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            zoomOut();
          }}
          className="rounded-full p-1 text-white transition-colors hover:bg-white/20"
          aria-label="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <span className="min-w-[3rem] text-center text-xs tabular-nums text-white">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            zoomIn();
          }}
          className="rounded-full p-1 text-white transition-colors hover:bg-white/20"
          aria-label="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goTo(current - 1);
            }}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goTo(current + 1);
            }}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>
          <span className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs tabular-nums text-white">
            {current + 1} / {images.length}
          </span>
        </>
      )}

      <img
        src={images[current]}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`max-h-[90vh] max-w-[90vw] select-none object-contain transition-transform duration-75 ${
          canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        style={{
          transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
}
