import { useEffect, useRef } from 'react';
import clsx from 'clsx';

import {
  AnimatePresence,
  dismiss,
  m,
  Overlay,
  spring,
  usePrefersReducedMotion,
} from '../motion';
import type { CatalogImage } from '../services/libraryApi';
import { Button } from './ui/Button';
import { CloseIcon } from './ui/icons/CloseIcon';

interface GalleryFullscreenViewerProps {
  images: CatalogImage[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  alt: string;
  onClose: () => void;
  /**
   * Viewport-relative point (percentages) the viewer scales out from when it
   * opens — the tapped thumbnail (spec 059 T055). Defaults to the centre.
   */
  originPercent?: { x: number; y: number };
}

/** Directional slide for the image swap — enters from the side the new index
 * lies on, exits toward the opposite side (research.md R8). */
const slideVariants = {
  enter: (direction: number) => ({ x: direction >= 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction >= 0 ? '-100%' : '100%', opacity: 0 }),
};

/**
 * Momentum projection (apple-design §6 / research.md R7): where the swipe
 * would come to rest if it kept decelerating at `decay`. Used only to read
 * the user's *intent* — the viewer always steps exactly one image, so a hard
 * flick never skips two (FR-012).
 */
export function projectSwipe(velocity: number, decay = 0.999): number {
  return (velocity / 1000) * (decay / (1 - decay));
}

/**
 * Fullscreen image viewer. The dimmed + blurred backdrop, focus trap, focus
 * restoration and background scroll lock all come from `motion/Overlay`
 * (spec 059 US3 T064). US4 adds a horizontal swipe between images with
 * momentum projection, plus `ArrowLeft` / `ArrowRight` keys as the
 * non-gesture equivalent (FR-013) — the thumbnail buttons, Escape and the
 * close button are unchanged.
 */
export function GalleryFullscreenViewer({
  images,
  selectedIndex,
  onSelect,
  alt,
  onClose,
  originPercent,
}: GalleryFullscreenViewerProps) {
  const reduceMotion = usePrefersReducedMotion();
  const selected = images[selectedIndex];
  const swipeRef = useRef<HTMLDivElement>(null);

  const previousIndexRef = useRef(selectedIndex);
  const direction =
    selectedIndex > previousIndexRef.current
      ? 1
      : selectedIndex < previousIndexRef.current
        ? -1
        : 0;
  useEffect(() => {
    previousIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  function step(delta: number) {
    const next = selectedIndex + delta;
    if (next < 0 || next >= images.length) return;
    onSelect(next);
  }

  // Keyboard parity for the swipe gesture (FR-013).
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'ArrowLeft') step(-1);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, images.length, onSelect]);

  function handleSwipeEnd(
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: { offset: { x: number }; velocity: { x: number } },
  ) {
    const width = swipeRef.current?.offsetWidth ?? 0;
    const projected = info.offset.x + projectSwipe(info.velocity.x);
    const passedThreshold =
      (width > 0 && Math.abs(projected) > width * dismiss.distanceRatio) ||
      Math.abs(info.velocity.x) >= dismiss.velocity;
    if (!passedThreshold) return;
    // Drag left (negative) → advance; drag right → go back. Always ±1.
    step(projected < 0 ? 1 : -1);
  }

  return (
    <Overlay
      open
      onClose={onClose}
      variant="center"
      surface="bare"
      ariaLabel={alt ? `${alt} — fullscreen image viewer` : 'Fullscreen image viewer'}
      scrim={{ className: 'bg-stone-950/90', blurPx: 4 }}
      scrimTestId="gallery-fullscreen-viewer"
      surfaceClassName="h-full w-full"
      surfaceStyle={{
        transformOrigin: originPercent
          ? `${originPercent.x}% ${originPercent.y}%`
          : 'center',
      }}
    >
      <div
        data-testid="gallery-viewer-surface"
        data-reduced-motion={reduceMotion ? 'true' : 'false'}
        className="flex h-full w-full items-center justify-center gap-3"
      >
        <m.div
          ref={swipeRef}
          data-testid="gallery-swipe-surface"
          onClick={(event) => event.stopPropagation()}
          drag={images.length > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={dismiss.elastic}
          dragMomentum={false}
          onDragEnd={handleSwipeEnd}
          className="relative flex h-full max-w-[calc(100%-5rem)] items-center justify-center overflow-hidden"
        >
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <m.img
              key={selected.url}
              src={selected.url}
              alt={alt}
              custom={direction}
              variants={slideVariants}
              initial={reduceMotion ? { opacity: 0 } : 'enter'}
              animate={reduceMotion ? { opacity: 1 } : 'center'}
              exit={reduceMotion ? { opacity: 0 } : 'exit'}
              transition={reduceMotion ? { duration: 0 } : spring.momentum}
              draggable={false}
              className="max-h-full max-w-full rounded-md object-contain"
            />
          </AnimatePresence>
        </m.div>

        {images.length > 1 && (
          <div
            onClick={(event) => event.stopPropagation()}
            className="scrollbar-hidden flex max-h-full w-16 flex-col gap-2 overflow-y-auto"
          >
            {images.map((image, index) => (
              <button
                key={image.url}
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === selectedIndex}
                className={clsx(
                  'aspect-square min-h-11 min-w-11 shrink-0 overflow-hidden rounded-md ring-2 transition-[box-shadow] duration-(--motion-duration-fade) ease-out',
                  index === selectedIndex
                    ? 'ring-primary'
                    : 'ring-transparent hover:ring-stone-300 dark:hover:ring-stone-700',
                )}
              >
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Button
        size="icon"
        variant="secondary"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        data-testid="gallery-fullscreen-close"
        className="fixed top-4 right-4"
      >
        <CloseIcon />
      </Button>
    </Overlay>
  );
}
