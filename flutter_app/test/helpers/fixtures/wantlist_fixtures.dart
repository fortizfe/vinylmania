import 'package:vinylmania/domain/models/wantlist/add_to_wantlist_result.dart';
import 'package:vinylmania/domain/models/wantlist/want_entry.dart';
import 'package:vinylmania/domain/models/wantlist/want_entry_detail.dart';

import 'catalog_fixtures.dart';

/// Wire shapes of `/api/wantlist` (frontend/src/services/wantlistApi.ts).

const wantEntryJson = <String, Object?>{
  'discogsReleaseId': 249504,
  'rating': 3,
  'notes': 'Find the first press',
  'addedAt': '2024-06-01T12:00:00.000Z',
  'catalogStatus': 'ok',
  'release': releaseJson,
};

const minimalWantEntryJson = <String, Object?>{
  'discogsReleaseId': 1,
  'rating': 0,
  'notes': null,
  'addedAt': '2024-01-01T00:00:00.000Z',
  'catalogStatus': 'unavailable',
  'release': null,
};

const wantlistPageJson = <String, Object?>{
  'items': [wantEntryJson, minimalWantEntryJson],
  'page': 2,
  'pageSize': 20,
  'totalItems': 40,
};

const wantEntryDetailJson = <String, Object?>{
  'discogsReleaseId': 249504,
  'rating': 3,
  'notes': 'Find the first press',
  'addedAt': '2024-06-01T12:00:00.000Z',
};

const minimalWantEntryDetailJson = <String, Object?>{
  'discogsReleaseId': 1,
  'rating': 0,
  'notes': null,
  'addedAt': '2024-01-01T00:00:00.000Z',
};

const addToWantlistResultJson = <String, Object?>{
  ...wantEntryJson,
  'alreadyInWantlist': false,
  'alreadyInLibrary': true,
};

final wantEntry = WantEntry.fromJson(wantEntryJson);
final minimalWantEntry = WantEntry.fromJson(minimalWantEntryJson);
final wantEntryDetail = WantEntryDetail.fromJson(wantEntryDetailJson);
final minimalWantEntryDetail = WantEntryDetail.fromJson(
  minimalWantEntryDetailJson,
);
final addToWantlistResult = AddToWantlistResult.fromJson(
  addToWantlistResultJson,
);
