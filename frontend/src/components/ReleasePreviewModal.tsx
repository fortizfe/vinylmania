import type { Release } from '../services/libraryApi';
import { Modal } from './ui/Modal';
import { Skeleton } from './ui/Skeleton';
import { ReleaseImageGallery } from './ReleaseImageGallery';
import { ReleaseDetailsSection } from './ReleaseDetailsSection';
import { ReleaseTracklistSection } from './ReleaseTracklistSection';
import { ReleaseAdditionalInfoSection } from './ReleaseAdditionalInfoSection';

interface ReleasePreviewModalProps {
  open: boolean;
  onClose: () => void;
  release: Release | null;
  loading: boolean;
}

export function ReleasePreviewModal({ open, onClose, release, loading }: ReleasePreviewModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Preview" size="lg" hideScrollbar>
      {!loading && !release && (
        <p className="text-gray-500 dark:text-gray-400">
          Couldn&apos;t load catalog details for this record right now.
        </p>
      )}

      <div
        data-testid="release-preview-content"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {loading && (
          <div data-testid="release-preview-loading" className="contents">
            <Skeleton className="aspect-square w-full lg:col-span-2" />
            <div className="grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
            <Skeleton className="h-16 w-full lg:col-span-2" />
          </div>
        )}

        {!loading && release && (
          <>
            <div data-testid="release-preview-gallery" className="lg:col-span-2">
              <ReleaseImageGallery images={release.images} alt={release.title} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2">
              <div data-testid="release-preview-details">
                <ReleaseDetailsSection release={release} />
              </div>

              <div data-testid="release-preview-tracklist">
                <ReleaseTracklistSection tracklist={release.tracklist} />
              </div>
            </div>

            <div data-testid="release-preview-additional-info" className="lg:col-span-2">
              <ReleaseAdditionalInfoSection
                notes={release.notes}
                identifiers={release.identifiers}
                community={release.community}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
