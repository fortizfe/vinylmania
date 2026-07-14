import { useState } from 'react';
import clsx from 'clsx';

import type { CatalogImage } from '../services/libraryApi';
import { GalleryFullscreenViewer } from './GalleryFullscreenViewer';

interface ReleaseImageGalleryProps {
  images: CatalogImage[];
  alt: string;
}

function initialIndex(images: CatalogImage[]): number {
  const primaryIndex = images.findIndex((image) => image.imageType === 'primary');
  return primaryIndex === -1 ? 0 : primaryIndex;
}

export function ReleaseImageGallery({ images, alt }: ReleaseImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => initialIndex(images));
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const selected = images[selectedIndex];

  if (!selected) {
    return (
      <div
        role="img"
        aria-label={`No cover image available for ${alt}`}
        className="flex aspect-square w-full items-center justify-center rounded-md bg-stone-100 text-sm text-stone-400 dark:bg-stone-900 dark:text-stone-500"
      >
        No cover image available
      </div>
    );
  }

  return (
    <div className="mx-auto flex aspect-square gap-3 overflow-hidden lg:max-w-md">
      <button
        type="button"
        onClick={() => setIsFullscreenOpen(true)}
        aria-label={`View ${alt} fullscreen`}
        className="aspect-square min-w-0 flex-1"
      >
        <img
          src={selected.url}
          alt={alt}
          className="h-full w-full rounded-md object-cover"
        />
      </button>

      {images.length > 1 && (
        <div className="scrollbar-hidden flex w-16 min-h-0 flex-col gap-2 overflow-y-auto">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setSelectedIndex(index)}
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

      {isFullscreenOpen && (
        <GalleryFullscreenViewer
          images={images}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          alt={alt}
          onClose={() => setIsFullscreenOpen(false)}
        />
      )}
    </div>
  );
}
