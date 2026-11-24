import '../../domain/models/paged.dart';
import '../../domain/models/wantlist/add_to_wantlist_result.dart';
import '../../domain/models/wantlist/want_entry.dart';
import '../../domain/models/wantlist/want_entry_detail.dart';
import 'api_client.dart';

/// `/api/wantlist` calls.
class WantlistApi {
  WantlistApi(this._client);

  final ApiClient _client;

  Future<Paged<WantEntry>> list({
    required int page,
    required int pageSize,
    bool refresh = false,
  }) async {
    final body = await _client.get(
      '/api/wantlist',
      query: {
        'page': '$page',
        'pageSize': '$pageSize',
        if (refresh) 'refresh': 'true',
      },
    ) as Map<String, Object?>;
    return Paged(
      items: [
        for (final e in body['items'] as List)
          WantEntry.fromJson(e as Map<String, Object?>),
      ],
      page: body['page'] as int,
      hasMore:
          (body['page'] as int) * (body['pageSize'] as int) <
          (body['totalItems'] as int),
      totalItems: body['totalItems'] as int,
    );
  }

  Future<WantEntryDetail> get(int releaseId) async => WantEntryDetail.fromJson(
    await _client.get('/api/wantlist/$releaseId') as Map<String, Object?>,
  );

  Future<AddToWantlistResult> add(int discogsReleaseId) async =>
      AddToWantlistResult.fromJson(
        await _client.post(
          '/api/wantlist',
          body: {'discogsReleaseId': discogsReleaseId},
        ) as Map<String, Object?>,
      );

  Future<WantEntryDetail> update(
    int releaseId,
    Map<String, Object> patch,
  ) async => WantEntryDetail.fromJson(
    await _client.patch('/api/wantlist/$releaseId', body: patch)
        as Map<String, Object?>,
  );

  Future<void> remove(int releaseId) =>
      _client.delete('/api/wantlist/$releaseId');
}
