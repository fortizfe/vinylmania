import 'package:flutter/foundation.dart';
import 'package:vinylmania/data/repositories/wantlist_repository.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/domain/models/wantlist/add_to_wantlist_result.dart';
import 'package:vinylmania/domain/models/wantlist/want_entry.dart';
import 'package:vinylmania/domain/models/wantlist/want_entry_detail.dart';

import '../fixtures/wantlist_fixtures.dart';

/// Each call is answered by its `onX` handler (defaults: fixtures; `onGet`
/// defaults to null = not in the wantlist). Successful add/update/remove
/// notify listeners, like the real repository.
class FakeWantlistRepository extends ChangeNotifier
    implements WantlistRepository {
  Future<Paged<WantEntry>> Function(int page, bool refresh) onList =
      (page, _) async => Paged(
        items: [wantEntry, minimalWantEntry],
        page: page,
        hasMore: false,
      );
  Future<WantEntryDetail?> Function(int releaseId) onGet = (_) async => null;
  Future<AddToWantlistResult> Function(int releaseId) onAdd = (_) async =>
      addToWantlistResult;
  Future<WantEntryDetail> Function(int releaseId, int? rating, String? notes)
  onUpdate = (_, _, _) async => wantEntryDetail;
  Future<void> Function(int releaseId) onRemove = (_) async {};

  @override
  Future<Paged<WantEntry>> list({int page = 1, bool refresh = false}) =>
      onList(page, refresh);

  @override
  Future<WantEntryDetail?> get(int releaseId) => onGet(releaseId);

  @override
  Future<AddToWantlistResult> add(int releaseId) async {
    final result = await onAdd(releaseId);
    notifyListeners();
    return result;
  }

  @override
  Future<WantEntryDetail> update(
    int releaseId, {
    int? rating,
    String? notes,
  }) async {
    final detail = await onUpdate(releaseId, rating, notes);
    notifyListeners();
    return detail;
  }

  @override
  Future<void> remove(int releaseId) async {
    await onRemove(releaseId);
    notifyListeners();
  }
}
