import '../../domain/models/catalog/catalog_filters.dart';
import '../../domain/models/catalog/catalog_search_result.dart';
import '../../domain/models/catalog/catalog_suggestion.dart';
import '../../domain/models/catalog/master_release.dart';
import '../../domain/models/catalog/master_release_version.dart';
import '../../domain/models/catalog/release.dart';
import '../../domain/models/paged.dart';
import 'api_client.dart';

/// `/api/discogs/*` catalog calls (suggest, search, releases, masters).
class DiscogsCatalogApi {
  DiscogsCatalogApi(this._client);

  final ApiClient _client;

  Future<List<CatalogSuggestion>> suggest(String query) async {
    final json = await _client.get(
      '/api/discogs/suggest',
      query: {'q': query},
    ) as Map<String, Object?>;
    return [
      for (final s in json['suggestions'] as List)
        CatalogSuggestion.fromJson(s as Map<String, Object?>),
    ];
  }

  Future<Paged<CatalogSearchResult>> search(
    String query, {
    required int page,
    required int perPage,
    CatalogFilters filters = CatalogFilters.none,
  }) async {
    final json = await _client.get(
      '/api/discogs/search',
      query: {
        'q': query,
        'type': 'release',
        'page': '$page',
        'perPage': '$perPage',
        ...filters.toQuery(),
      },
    );
    return _paged(json, CatalogSearchResult.fromJson);
  }

  Future<Release> getRelease(int id) async => Release.fromJson(
    await _client.get('/api/discogs/releases/$id') as Map<String, Object?>,
  );

  Future<MasterRelease> getMaster(int id) async => MasterRelease.fromJson(
    await _client.get('/api/discogs/masters/$id') as Map<String, Object?>,
  );

  Future<Paged<MasterReleaseVersion>> getMasterVersions(
    int id, {
    required int page,
  }) async {
    final json = await _client.get(
      '/api/discogs/masters/$id/versions',
      query: {'page': '$page'},
    );
    return _paged(json, MasterReleaseVersion.fromJson);
  }

  /// `{results, pagination: {page, pages}}` → [Paged].
  static Paged<T> _paged<T>(
    Object? json,
    T Function(Map<String, Object?>) fromJson,
  ) {
    final body = json as Map<String, Object?>;
    final pagination = body['pagination'] as Map<String, Object?>;
    final page = pagination['page'] as int;
    return Paged(
      items: [
        for (final r in body['results'] as List)
          fromJson(r as Map<String, Object?>),
      ],
      page: page,
      hasMore: page < (pagination['pages'] as int),
    );
  }
}
