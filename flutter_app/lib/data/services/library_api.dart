import '../../domain/models/catalog/catalog_filters.dart';
import '../../domain/models/library/library_entry.dart';
import '../../domain/models/library/library_sort.dart';
import '../../domain/models/paged.dart';
import 'api_client.dart';

/// `/api/library` calls.
class LibraryApi {
  LibraryApi(this._client);

  final ApiClient _client;

  Future<Paged<LibraryEntry>> list({
    required int page,
    required int pageSize,
    required LibrarySort sort,
    CatalogFilters filters = CatalogFilters.none,
    bool refresh = false,
  }) async {
    final body = await _client.get(
      '/api/library',
      query: {
        'page': '$page',
        'pageSize': '$pageSize',
        if (refresh) 'refresh': 'true',
        'sort': sort.field,
        'dir': sort.dir,
        ...filters.toQuery(),
      },
    ) as Map<String, Object?>;
    return Paged(
      items: [
        for (final e in body['items'] as List)
          LibraryEntry.fromJson(e as Map<String, Object?>),
      ],
      page: body['page'] as int,
      hasMore:
          (body['page'] as int) * (body['pageSize'] as int) <
          (body['totalItems'] as int),
      totalItems: body['totalItems'] as int,
    );
  }

  Future<LibraryEntry> get(String entryId) async => LibraryEntry.fromJson(
    await _client.get(_path(entryId)) as Map<String, Object?>,
  );

  Future<LibraryEntry> create(int discogsReleaseId) async =>
      LibraryEntry.fromJson(
        await _client.post(
          '/api/library',
          body: {'discogsReleaseId': discogsReleaseId},
        ) as Map<String, Object?>,
      );

  /// [patch] carries one field: the record detail autosaves field by field.
  Future<LibraryEntry> update(
    String entryId,
    Map<String, Object> patch,
  ) async => LibraryEntry.fromJson(
    await _client.patch(_path(entryId), body: patch) as Map<String, Object?>,
  );

  Future<void> remove(String entryId) => _client.delete(_path(entryId));

  static String _path(String entryId) =>
      '/api/library/${Uri.encodeComponent(entryId)}';
}
