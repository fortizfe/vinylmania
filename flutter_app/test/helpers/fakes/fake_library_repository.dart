import 'package:flutter/foundation.dart';
import 'package:vinylmania/data/repositories/library_repository.dart';
import 'package:vinylmania/domain/models/catalog/catalog_filters.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/domain/models/library/library_sort.dart';
import 'package:vinylmania/domain/models/paged.dart';

import '../fixtures/library_fixtures.dart';

/// Each call is answered by its `onX` handler (defaults: fixtures). Like the
/// real repository, successful add/updateCopy/remove notify listeners.
class FakeLibraryRepository extends ChangeNotifier
    implements LibraryRepository {
  Future<Paged<LibraryEntry>> Function(
    int page,
    LibrarySort sort,
    CatalogFilters filters,
    bool refresh,
  )
  onList = (page, _, _, _) async => Paged(
    items: [libraryEntry, minimalLibraryEntry],
    page: page,
    hasMore: false,
  );
  Future<LibraryEntry> Function(String entryId) onGet = (_) async =>
      libraryEntry;
  Future<LibraryEntry> Function(int releaseId) onAdd = (_) async =>
      libraryEntry;

  /// Receives the one-field patch, e.g. `{'rating': 4}`.
  Future<LibraryEntry> Function(String entryId, Map<String, Object> patch)
  onUpdateCopy = (_, _) async => libraryEntry;
  Future<void> Function(String entryId) onRemove = (_) async {};

  @override
  Future<Paged<LibraryEntry>> list({
    int page = 1,
    LibrarySort sort = LibrarySort.newestFirst,
    CatalogFilters filters = CatalogFilters.none,
    bool refresh = false,
  }) => onList(page, sort, filters, refresh);

  @override
  Future<LibraryEntry> get(String entryId) => onGet(entryId);

  @override
  Future<LibraryEntry> add(int releaseId) async {
    final entry = await onAdd(releaseId);
    notifyListeners();
    return entry;
  }

  @override
  Future<LibraryEntry> updateCopy(
    String entryId,
    String field,
    Object value,
  ) async {
    final entry = await onUpdateCopy(entryId, {field: value});
    notifyListeners();
    return entry;
  }

  @override
  Future<void> remove(String entryId) async {
    await onRemove(entryId);
    notifyListeners();
  }
}
