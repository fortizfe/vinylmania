import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';

import '../../helpers/fixtures/catalog_fixtures.dart';

void main() {
  group('Release.fromJson', () {
    test('maps every field of a populated release', () {
      expect(release.discogsId, 249504);
      expect(release.title, 'Master Of Puppets');
      expect(release.year, 1986);
      expect(release.country, 'US');
      expect(release.releaseDate, '1986-03-03');
      expect(release.notes, startsWith('Recorded'));
      expect(release.artists.single.name, 'Metallica');
      expect(release.artists.single.discogsArtistId, 18839);
      expect(release.artists.single.nameVariation, 'Metallica.');
      expect(release.artists.single.joinPhrase, '');
      expect(release.labels.single.catalogNumber, '60439-1');
      expect(release.labels.single.discogsLabelId, 1003);
      expect(release.formats.single.name, 'Vinyl');
      expect(release.formats.single.quantity, 1);
      expect(release.formats.single.descriptions, ['LP', 'Album']);
      expect(release.genres, ['Rock']);
      expect(release.styles, ['Thrash', 'Heavy Metal']);
      expect(release.identifiers.single.type, 'Barcode');
      expect(release.identifiers.single.value, '075596043910');
      expect(release.identifiers.single.description, 'Text');
      expect(release.community!.have, 50213);
      expect(release.community!.want, 9120);
      expect(release.community!.rating.average, 4.75);
      expect(release.community!.rating.count, 3021);
      expect(release.tracklist.map((t) => t.title), [
        'Battery',
        'Master Of Puppets',
      ]);
      expect(release.tracklist.first.duration, '5:10');
      expect(release.images.first.url, 'https://img.example/primary.jpg');
      expect(release.images.first.imageType, 'primary');
      expect(release.images.first.width, 600);
      expect(release.images.last.height, isNull);
      expect(release.masterId, 6513);
      expect(release.discogsUrl, 'https://www.discogs.com/release/249504');
    });

    test('leaves optional fields null on a minimal release', () {
      expect(minimalRelease.year, isNull);
      expect(minimalRelease.country, isNull);
      expect(minimalRelease.releaseDate, isNull);
      expect(minimalRelease.notes, isNull);
      expect(minimalRelease.community, isNull);
      expect(minimalRelease.masterId, isNull);
      expect(minimalRelease.formats.single.quantity, isNull);
      expect(minimalRelease.tracklist.single.duration, isNull);
      expect(minimalRelease.artists, isEmpty);
      expect(minimalRelease.images, isEmpty);
    });
  });

  test('CatalogSearchResult.fromJson maps populated and minimal results', () {
    expect(searchResult.discogsId, 249504);
    expect(searchResult.resultType, 'release');
    expect(searchResult.artist, 'Metallica');
    expect(searchResult.thumbnailUrl, 'https://img.example/thumb.jpg');
    expect(searchResult.year, 1986);
    expect(searchResult.formats, ['Vinyl', 'LP']);
    expect(searchResult.communityRating!.average, 4.0);
    expect(searchResult.communityRating!.count, 12);
    expect(searchResult.country, 'US');
    expect(searchResult.labels, ['Elektra']);

    expect(minimalSearchResult.artist, isNull);
    expect(minimalSearchResult.formats, isEmpty);
    expect(minimalSearchResult.labels, isEmpty);
    expect(minimalSearchResult.communityRating, isNull);
  });

  test('CatalogSuggestion.fromJson maps populated and minimal suggestions', () {
    expect(suggestion.discogsId, 6513);
    expect(suggestion.resultType, 'master');
    expect(suggestion.title, 'Master Of Puppets');
    expect(suggestion.artist, 'Metallica');
    expect(suggestion.year, 1986);
    expect(suggestion.format, 'Vinyl');
    expect(suggestion.thumbnailUrl, isNotNull);

    expect(minimalSuggestion.resultType, 'artist');
    expect(minimalSuggestion.artist, isNull);
    expect(minimalSuggestion.year, isNull);
  });

  test('MasterRelease.fromJson maps populated and minimal masters', () {
    expect(master.discogsId, 6513);
    expect(master.year, 1986);
    expect(master.artists.single.name, 'Metallica');
    expect(master.genres, ['Rock']);
    expect(master.styles, ['Thrash']);
    expect(master.images.single.imageType, 'primary');
    expect(master.tracklist.single.position, 'A1');
    expect(master.mainReleaseId, 249504);
    expect(master.discogsUrl, 'https://www.discogs.com/master/6513');

    expect(minimalMaster.year, isNull);
    expect(minimalMaster.tracklist, isEmpty);
  });

  test('MasterReleaseVersion.fromJson maps populated and minimal rows', () {
    expect(masterVersion.discogsId, 249504);
    expect(masterVersion.format, 'Vinyl, LP, Album');
    expect(masterVersion.year, 1986);
    expect(masterVersion.label, 'Elektra');
    expect(masterVersion.country, 'US');
    expect(masterVersion.thumbnailUrl, isNotNull);

    expect(minimalMasterVersion.format, isNull);
    expect(minimalMasterVersion.label, isNull);
  });

  group('CatalogFilters', () {
    test('none is empty and produces no query', () {
      expect(CatalogFilters.none.isEmpty, isTrue);
      expect(CatalogFilters.none.toQuery(), isEmpty);
    });

    test('toQuery comma-joins each facet in canonical option order', () {
      const filters = CatalogFilters(
        genre: {'Rock', 'Blues'},
        style: {'Thrash', 'Doom Metal'},
        format: {'Vinyl'},
      );

      expect(filters.isEmpty, isFalse);
      expect(filters.toQuery(), {
        'genre': 'Blues,Rock',
        'style': 'Doom Metal,Thrash',
        'format': 'Vinyl',
      });
    });

    test('toQuery omits empty facets', () {
      expect(const CatalogFilters(format: {'CD'}).toQuery(), {'format': 'CD'});
    });
  });
}
