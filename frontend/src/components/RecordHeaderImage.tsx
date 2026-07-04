import { Card } from './ui/Card';
import type { CatalogImage } from '../services/libraryApi';

interface RecordHeaderImageProps {
  images: CatalogImage[];
  alt: string;
}

export function RecordHeaderImage({ images, alt }: RecordHeaderImageProps) {
  const image = images.find((candidate) => candidate.imageType === 'primary') ?? images[0];

  return (
    <Card className="overflow-hidden p-0" padding="sm">
      {image ? (
        <img src={image.url} alt={alt} className="aspect-square w-full object-cover sm:aspect-video" />
      ) : (
        <div
          role="img"
          aria-label={`No cover image available for ${alt}`}
          className="flex aspect-square w-full items-center justify-center bg-gray-100 text-sm text-gray-400 sm:aspect-video dark:bg-gray-800 dark:text-gray-500"
        >
          No cover image available
        </div>
      )}
    </Card>
  );
}
