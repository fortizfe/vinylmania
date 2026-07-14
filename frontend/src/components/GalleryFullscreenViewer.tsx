import clsx from 'clsx';

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
}

export function GalleryFullscreenViewer({
  images,
  selectedIndex,
  onSelect,
  alt,
  onClose,
}: GalleryFullscreenViewerProps) {
  useEscapeKey(onClose, true);
  const selected = images[selectedIndex];

  return (
    <div
      data-testid="gallery-fullscreen-viewer"
      className="fixed inset-0 z-50 flex items-center justify-center gap-3 bg-black/90 p-4"
      onClick={onClose}
    >
      <img
        src={selected.url}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-[calc(100%-5rem)] rounded-md object-contain"
      />

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
                'aspect-square min-h-11 min-w-11 shrink-0 overflow-hidden rounded-md ring-2 transition',
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
