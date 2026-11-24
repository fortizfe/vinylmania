import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/domain/models/library/library_sort.dart';

import '../../helpers/fixtures/library_fixtures.dart';

import 'package:vinylmania/domain/models/library/wantlist_removal.dart';

void main() {
  group('LibraryEntry.fromJson', () {
    test('maps a detail entry with copy data', () {
      expect(libraryEntry.id, 'entry-1');
      expect(libraryEntry.discogsReleaseId, 249504);
      expect(libraryEntry.addedAt, DateTime.utc(2024, 5, 1, 10));
      expect(libraryEntry.isCatalogAvailable, isTrue);
      expect(libraryEntry.release!.title, 'Master Of Puppets');
      expect(libraryEntry.genre, ['Rock']);
      expect(libraryEntry.style, ['Thrash']);
      expect(libraryEntry.format, ['Vinyl']);
      expect(libraryEntry.wantlistRemoval, WantlistRemoval.notInWantlist);

      final copy = libraryEntry.discogs!;
      expect(copy.instanceId, 900);
      expect(copy.folderId, 1);
      expect(copy.rating, 4);
      expect(copy.mediaCondition, 'Near Mint (NM or M-)');
      expect(copy.sleeveCondition, 'Very Good Plus (VG+)');
      expect(copy.notes, 'Original pressing');
      expect(copy.mediaConditionEditable, isTrue);
      expect(copy.sleeveConditionEditable, isTrue);
      expect(copy.notesEditable, isFalse);
    });

    test('maps a minimal list row', () {
      expect(minimalLibraryEntry.isCatalogAvailable, isFalse);
      expect(minimalLibraryEntry.release, isNull);
      expect(minimalLibraryEntry.discogs, isNull);
      expect(minimalLibraryEntry.genre, isEmpty);
      expect(minimalLibraryEntry.wantlistRemoval, isNull);
    });

    test('maps every wantlistRemoval value', () {
      for (final (wire, value) in [
        ('removed', WantlistRemoval.removed),
        ('not_in_wantlist', WantlistRemoval.notInWantlist),
        ('failed', WantlistRemoval.failed),
      ]) {
        final json = {...minimalLibraryEntryJson, 'wantlistRemoval': wire};
        expect(LibraryEntry.fromJson(json).wantlistRemoval, value);
      }
    });
  });

  test('LibrarySort has the six web options in display order', () {
    expect(
      LibrarySort.values.map(
        (s) => (s.field, s.dir, s.group, s.label, s.announcement),
      ),
      [
        (
          'added',
          'desc',
          'Date added',
          'Newest first',
          'Sorted by date added, newest first.',
        ),
        (
          'added',
          'asc',
          'Date added',
          'Oldest first',
          'Sorted by date added, oldest first.',
        ),
        (
          'artist',
          'asc',
          'Artist',
          'Artist (A → Z)',
          'Sorted by artist, A to Z.',
        ),
        (
          'artist',
          'desc',
          'Artist',
          'Artist (Z → A)',
          'Sorted by artist, Z to A.',
        ),
        ('album', 'asc', 'Album', 'Album (A → Z)', 'Sorted by album, A to Z.'),
        ('album', 'desc', 'Album', 'Album (Z → A)', 'Sorted by album, Z to A.'),
      ],
    );
    expect(LibrarySort.values.first, LibrarySort.newestFirst);
  });
}
