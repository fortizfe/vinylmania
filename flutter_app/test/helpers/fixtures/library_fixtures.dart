import 'package:vinylmania/domain/models/library/library_entry.dart';

import 'catalog_fixtures.dart';

/// Wire shapes of `/api/library` (frontend/src/services/libraryApi.ts).

const copyDataJson = <String, Object?>{
  'instanceId': 900,
  'folderId': 1,
  'rating': 4,
  'mediaCondition': 'Near Mint (NM or M-)',
  'sleeveCondition': 'Very Good Plus (VG+)',
  'notes': 'Original pressing',
  'editable': {'mediaCondition': true, 'sleeveCondition': true, 'notes': false},
};

const libraryEntryJson = <String, Object?>{
  'id': 'entry-1',
  'discogsReleaseId': 249504,
  'addedAt': '2024-05-01T10:00:00.000Z',
  'catalogStatus': 'ok',
  'release': releaseJson,
  'discogs': copyDataJson,
  'genre': ['Rock'],
  'style': ['Thrash'],
  'format': ['Vinyl'],
  'wantlistRemoval': 'not_in_wantlist',
};

/// A list row: no copy data, release gone from the catalog.
const minimalLibraryEntryJson = <String, Object?>{
  'id': 'entry-2',
  'discogsReleaseId': 1,
  'addedAt': '2023-01-15T08:30:00.000Z',
  'catalogStatus': 'unavailable',
  'release': null,
  'discogs': null,
};

const libraryPageJson = <String, Object?>{
  'items': [libraryEntryJson, minimalLibraryEntryJson],
  'page': 1,
  'pageSize': 20,
  'totalItems': 42,
};

final libraryEntry = LibraryEntry.fromJson(libraryEntryJson);
final minimalLibraryEntry = LibraryEntry.fromJson(minimalLibraryEntryJson);
