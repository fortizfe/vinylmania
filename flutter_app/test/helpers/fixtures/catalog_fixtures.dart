import 'package:vinylmania/domain/models/catalog/catalog_search_result.dart';
import 'package:vinylmania/domain/models/catalog/catalog_suggestion.dart';
import 'package:vinylmania/domain/models/catalog/master_release.dart';
import 'package:vinylmania/domain/models/catalog/master_release_version.dart';
import 'package:vinylmania/domain/models/catalog/release.dart';

/// Wire shapes of `/api/discogs/*` (frontend/src/services/discogsApi.ts,
/// libraryApi.ts). One populated and one minimal fixture per model.

const releaseJson = <String, Object?>{
  'discogsId': 249504,
  'title': 'Master Of Puppets',
  'year': 1986,
  'country': 'US',
  'releaseDate': '1986-03-03',
  'notes': 'Recorded at Sweet Silence Studios.',
  'artists': [
    {
      'discogsArtistId': 18839,
      'name': 'Metallica',
      'nameVariation': 'Metallica.',
      'joinPhrase': '',
    },
  ],
  'labels': [
    {'discogsLabelId': 1003, 'name': 'Elektra', 'catalogNumber': '60439-1'},
  ],
  'formats': [
    {
      'name': 'Vinyl',
      'quantity': 1,
      'descriptions': ['LP', 'Album'],
    },
  ],
  'genres': ['Rock'],
  'styles': ['Thrash', 'Heavy Metal'],
  'identifiers': [
    {'type': 'Barcode', 'value': '075596043910', 'description': 'Text'},
  ],
  'community': {
    'have': 50213,
    'want': 9120,
    'rating': {'average': 4.75, 'count': 3021},
  },
  'tracklist': [
    {'position': 'A1', 'title': 'Battery', 'duration': '5:10'},
    {'position': 'A2', 'title': 'Master Of Puppets', 'duration': '8:35'},
  ],
  'images': [
    {
      'url': 'https://img.example/primary.jpg',
      'imageType': 'primary',
      'width': 600,
      'height': 600,
    },
    {'url': 'https://img.example/back.jpg', 'imageType': 'secondary'},
  ],
  'masterId': 6513,
  'discogsUrl': 'https://www.discogs.com/release/249504',
};

const minimalReleaseJson = <String, Object?>{
  'discogsId': 1,
  'title': 'Untitled',
  'artists': <Object?>[],
  'labels': <Object?>[],
  'formats': [
    {'name': 'Vinyl', 'descriptions': <Object?>[]},
  ],
  'genres': <Object?>[],
  'styles': <Object?>[],
  'identifiers': <Object?>[],
  'tracklist': [
    {'position': '1', 'title': 'Intro'},
  ],
  'images': <Object?>[],
  'discogsUrl': 'https://www.discogs.com/release/1',
};

const searchResultJson = <String, Object?>{
  'discogsId': 249504,
  'resultType': 'release',
  'title': 'Master Of Puppets',
  'artist': 'Metallica',
  'thumbnailUrl': 'https://img.example/thumb.jpg',
  'year': 1986,
  'formats': ['Vinyl', 'LP'],
  'communityRating': {'average': 4, 'count': 12},
  'country': 'US',
  'labels': ['Elektra'],
};

const minimalSearchResultJson = <String, Object?>{
  'discogsId': 2,
  'resultType': 'release',
  'title': 'Unknown',
};

const searchResponseJson = <String, Object?>{
  'results': [searchResultJson, minimalSearchResultJson],
  'pagination': {'page': 1, 'pages': 3, 'items': 42, 'perPage': 20},
};

const suggestionJson = <String, Object?>{
  'discogsId': 6513,
  'resultType': 'master',
  'title': 'Master Of Puppets',
  'artist': 'Metallica',
  'year': 1986,
  'format': 'Vinyl',
  'thumbnailUrl': 'https://img.example/thumb.jpg',
};

const minimalSuggestionJson = <String, Object?>{
  'discogsId': 18839,
  'resultType': 'artist',
  'title': 'Metallica',
};

const masterJson = <String, Object?>{
  'discogsId': 6513,
  'title': 'Master Of Puppets',
  'year': 1986,
  'artists': [
    {'discogsArtistId': 18839, 'name': 'Metallica'},
  ],
  'genres': ['Rock'],
  'styles': ['Thrash'],
  'images': [
    {'url': 'https://img.example/primary.jpg', 'imageType': 'primary'},
  ],
  'tracklist': [
    {'position': 'A1', 'title': 'Battery', 'duration': '5:10'},
  ],
  'mainReleaseId': 249504,
  'discogsUrl': 'https://www.discogs.com/master/6513',
};

const minimalMasterJson = <String, Object?>{
  'discogsId': 7,
  'title': 'Untitled',
  'artists': <Object?>[],
  'genres': <Object?>[],
  'styles': <Object?>[],
  'images': <Object?>[],
  'tracklist': <Object?>[],
  'mainReleaseId': 1,
  'discogsUrl': 'https://www.discogs.com/master/7',
};

const masterVersionJson = <String, Object?>{
  'discogsId': 249504,
  'title': 'Master Of Puppets',
  'format': 'Vinyl, LP, Album',
  'year': 1986,
  'label': 'Elektra',
  'country': 'US',
  'thumbnailUrl': 'https://img.example/thumb.jpg',
};

const minimalMasterVersionJson = <String, Object?>{
  'discogsId': 3,
  'title': 'Master Of Puppets',
};

const masterVersionsResponseJson = <String, Object?>{
  'results': [masterVersionJson, minimalMasterVersionJson],
  'pagination': {'page': 2, 'pages': 2, 'items': 22, 'perPage': 20},
};

final release = Release.fromJson(releaseJson);
final minimalRelease = Release.fromJson(minimalReleaseJson);
final searchResult = CatalogSearchResult.fromJson(searchResultJson);
final minimalSearchResult = CatalogSearchResult.fromJson(
  minimalSearchResultJson,
);
final suggestion = CatalogSuggestion.fromJson(suggestionJson);
final minimalSuggestion = CatalogSuggestion.fromJson(minimalSuggestionJson);
final master = MasterRelease.fromJson(masterJson);
final minimalMaster = MasterRelease.fromJson(minimalMasterJson);
final masterVersion = MasterReleaseVersion.fromJson(masterVersionJson);
final minimalMasterVersion = MasterReleaseVersion.fromJson(
  minimalMasterVersionJson,
);
