import { useState } from 'react';
import clsx from 'clsx';

import type { CatalogImage } from '../services/libraryApi';

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
  const selected = images[selectedIndex];

  if (!selected) {
    return (
      <div
        role="img"
        aria-label={`No cover image available for ${alt}`}
        className="flex aspect-square w-full items-center justify-center rounded-md bg-gray-100 text-sm text-gray-400 dark:bg-gray-900 dark:text-gray-500"
      >
        No cover image available
      </div>
    );
  }

  return (
    <div className="flex gap-3 aspect-square">
      <img
        src={selected.url}
        alt={alt}
        className="aspect-square min-w-0 flex-1 rounded-md object-cover"
      />

      {images.length > 1 && (
        <div className="scrollbar-hidden flex w-16 flex-col gap-2 overflow-y-auto">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-current={index === selectedIndex}
              className={clsx(
                'aspect-square shrink-0 overflow-hidden rounded-md ring-2 transition',
                index === selectedIndex
                  ? 'ring-primary'
                  : 'ring-transparent hover:ring-gray-300 dark:hover:ring-gray-700',
              )}
            >
              <img src={image.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
