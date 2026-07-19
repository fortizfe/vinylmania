import { useNavigate, useParams } from 'react-router-dom';

import { MyCopySection } from '../components/MyCopySection';
import { RecordDetailSkeleton } from '../components/RecordDetailSkeleton';
import { ReleaseAdditionalInfoSection } from '../components/ReleaseAdditionalInfoSection';
import { ReleaseDetailsSection } from '../components/ReleaseDetailsSection';
import { ReleaseImageGallery } from '../components/ReleaseImageGallery';
import { ReleaseTracklistSection } from '../components/ReleaseTracklistSection';
import { BackLink } from '../components/ui/BackLink';
import { Card } from '../components/ui/Card';
import {
  useLibraryEntry,
  useRemoveLibraryEntry,
  useUpdateLibraryEntry,
} from '../queries/libraryQueries';

export function RecordDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading, isError: notFound } = useLibraryEntry(entryId);
  const updateEntry = useUpdateLibraryEntry(entryId ?? '');
  const removeEntry = useRemoveLibraryEntry();

  async function handleRemove() {
    if (!entryId) return;
    if (!window.confirm('Remove this record from your library? This cannot be undone.')) {
      return;
    }
    try {
      await removeEntry.mutateAsync(entryId);
      navigate('/app/library');
    } catch {
      // Error handled by removeEntry.isError
    }
  }

  async function saveRating(rating: number) {
    await updateEntry.mutateAsync({ rating });
  }

  async function saveMediaCondition(value: string | null) {
    await updateEntry.mutateAsync({ mediaCondition: value ?? undefined });
  }

  async function saveSleeveCondition(value: string | null) {
    await updateEntry.mutateAsync({ sleeveCondition: value ?? undefined });
  }

  async function saveNotes(notes: string) {
    await updateEntry.mutateAsync({ notes });
  }

  if (notFound) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to="/app/library" />
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            Couldn&apos;t find that record in your library.
          </p>
        </Card>
      </main>
    );
  }

  if (isLoading || !entry) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
        <BackLink to="/app/library" />
        <RecordDetailSkeleton />
      </main>
    );
  }

  const myCopySection = (
    <MyCopySection
      discogs={entry.discogs}
      onSaveRating={saveRating}
      onSaveMediaCondition={saveMediaCondition}
      onSaveSleeveCondition={saveSleeveCondition}
      onSaveNotes={saveNotes}
      onRemove={handleRemove}
    />
  );

  if (entry.catalogStatus === 'unavailable' || !entry.release) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <BackLink to="/app/library" />
        <Card>
          <p className="text-stone-500 dark:text-stone-400">
            Couldn&apos;t load catalog details for this record right now.
          </p>
        </Card>
        <Card>{myCopySection}</Card>
      </main>
    );
  }

  const { release } = entry;
  const hasOtherDetails =
    Boolean(release.notes) ||
    (release.identifiers?.length ?? 0) > 0 ||
    Boolean(release.community);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8 xl:max-w-7xl">
      <BackLink to="/app/library" />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card data-testid="record-detail-gallery-card" padding="sm">
          <ReleaseImageGallery images={release.images} alt={release.title} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card data-testid="record-detail-main-info-card" padding="sm">
            <ReleaseDetailsSection release={release} />
          </Card>
          <Card data-testid="record-detail-your-copy-card" padding="sm">
            {myCopySection}
          </Card>
        </div>

        <Card data-testid="record-detail-tracklist-card" padding="sm" className="lg:col-span-2">
          <ReleaseTracklistSection tracklist={release.tracklist} />
        </Card>

        {hasOtherDetails && (
          <Card
            data-testid="record-detail-other-details-card"
            padding="sm"
            className="lg:col-span-2"
          >
            <ReleaseAdditionalInfoSection
              notes={release.notes}
              identifiers={release.identifiers}
              community={release.community}
            />
          </Card>
        )}
      </div>
    </main>
  );
}
