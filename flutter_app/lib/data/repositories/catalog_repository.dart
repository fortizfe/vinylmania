import '../../domain/models/catalog/catalog_filters.dart';
import '../../domain/models/catalog/catalog_search_result.dart';
import '../../domain/models/catalog/catalog_suggestion.dart';
import '../../domain/models/catalog/master_release.dart';
import '../../domain/models/catalog/master_release_version.dart';
import '../../domain/models/catalog/release.dart';
import '../../domain/models/paged.dart';
import '../services/discogs_catalog_api.dart';

/// Discogs catalog data. Throws `ApiException`.
class CatalogRepository {
  CatalogRepository({required this._api});

  final DiscogsCatalogApi _api;

  Future<List<CatalogSuggestion>> suggest(String query) => _api.suggest(query);

  Future<Paged<CatalogSearchResult>> search(
    String query, {
    int page = 1,
    CatalogFilters filters = CatalogFilters.none,
  }) => _api.search(query, page: page, perPage: 20, filters: filters);

  Future<Release> getRelease(int id) => _api.getRelease(id);

  Future<MasterRelease> getMaster(int id) => _api.getMaster(id);

  Future<Paged<MasterReleaseVersion>> getMasterVersions(
    int id, {
    int page = 1,
  }) => _api.getMasterVersions(id, page: page);
}
