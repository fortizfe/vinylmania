import { useEffect, useRef } from 'react';
import clsx from 'clsx';

import { AnimatePresence, m, spring, usePrefersReducedMotion } from '../motion';
import { useEscapeKey } from '../hooks/useEscapeKey';
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

export function GalleryFullscreenViewer({
  images,
  selectedIndex,
  onSelect,
  alt,
  onClose,
  originPercent,
}: GalleryFullscreenViewerProps) {
  useEscapeKey(onClose, true);
  const reduceMotion = usePrefersReducedMotion();
  const selected = images[selectedIndex];

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

  return (
    <div
      data-testid="gallery-fullscreen-viewer"
      className="fixed inset-0 z-50 bg-black/90 p-4"
      onClick={onClose}
    >
      <m.div
        data-testid="gallery-viewer-surface"
        data-reduced-motion={reduceMotion ? 'true' : 'false'}
        className="flex h-full w-full items-center justify-center gap-3"
        style={{
          transformOrigin: originPercent
            ? `${originPercent.x}% ${originPercent.y}%`
            : 'center',
        }}
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : spring.default}
      >
        <div
          onClick={(event) => event.stopPropagation()}
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
              className="max-h-full max-w-full rounded-md object-contain"
            />
          </AnimatePresence>
        </div>

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
      </m.div>

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
    </div>
  );
}
