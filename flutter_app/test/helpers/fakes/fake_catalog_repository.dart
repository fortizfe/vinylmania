import 'package:vinylmania/data/repositories/catalog_repository.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';
import 'package:vinylmania/domain/models/catalog/catalog_search_result.dart';
import 'package:vinylmania/domain/models/catalog/catalog_suggestion.dart';
import 'package:vinylmania/domain/models/catalog/master_release.dart';
import 'package:vinylmania/domain/models/catalog/master_release_version.dart';
import 'package:vinylmania/domain/models/catalog/release.dart';
import 'package:vinylmania/domain/models/paged.dart';

import '../fixtures/catalog_fixtures.dart';

/// Each call is answered by its `onX` handler (defaults: fixtures). Swap a
/// handler to return other data, throw an `ApiException`, or hold a
/// `Completer` to test in-flight states.
class FakeCatalogRepository implements CatalogRepository {
  Future<List<CatalogSuggestion>> Function(String query) onSuggest = (
    _,
  ) async => [suggestion, minimalSuggestion];
  Future<Paged<CatalogSearchResult>> Function(
    String query,
    int page,
    CatalogFilters filters,
  )
  onSearch = (_, page, _) async => Paged(
    items: [searchResult, minimalSearchResult],
    page: page,
    hasMore: false,
  );
  Future<Release> Function(int id) onGetRelease = (_) async => release;
  Future<MasterRelease> Function(int id) onGetMaster = (_) async => master;
  Future<Paged<MasterReleaseVersion>> Function(int id, int page)
  onGetMasterVersions = (_, page) async => Paged(
    items: [masterVersion, minimalMasterVersion],
    page: page,
    hasMore: false,
  );

  @override
  Future<List<CatalogSuggestion>> suggest(String query) => onSuggest(query);

  @override
  Future<Paged<CatalogSearchResult>> search(
    String query, {
    int page = 1,
    CatalogFilters filters = CatalogFilters.none,
  }) => onSearch(query, page, filters);

  @override
  Future<Release> getRelease(int id) => onGetRelease(id);

  @override
  Future<MasterRelease> getMaster(int id) => onGetMaster(id);

  @override
  Future<Paged<MasterReleaseVersion>> getMasterVersions(
    int id, {
    int page = 1,
  }) => onGetMasterVersions(id, page);
}
