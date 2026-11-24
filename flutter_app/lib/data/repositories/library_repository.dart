import 'package:flutter/foundation.dart';

import '../../domain/models/catalog/catalog_filters.dart';
import '../../domain/models/library/library_entry.dart';
import '../../domain/models/library/library_sort.dart';
import '../../domain/models/paged.dart';
import '../services/library_api.dart';

/// The user's library. Notifies after every successful mutation so list
/// screens reload. Throws `ApiException`.
class LibraryRepository extends ChangeNotifier {
  LibraryRepository({required this._api});

  final LibraryApi _api;

  Future<Paged<LibraryEntry>> list({
    int page = 1,
    LibrarySort sort = LibrarySort.newestFirst,
    CatalogFilters filters = CatalogFilters.none,
    bool refresh = false,
  }) => _api.list(
    page: page,
    pageSize: 20,
    sort: sort,
    filters: filters,
    refresh: refresh,
  );

  Future<LibraryEntry> get(String entryId) => _api.get(entryId);

  Future<LibraryEntry> add(int releaseId) async {
    final entry = await _api.create(releaseId);
    notifyListeners();
    return entry;
  }

  /// Saves one copy field (the record detail autosaves field by field).
  /// `rating` 0 clears the rating, `notes` '' clears the notes.
  Future<LibraryEntry> updateCopy(
    String entryId,
    String field,
    Object value,
  ) async {
    final entry = await _api.update(entryId, {field: value});
    notifyListeners();
    return entry;
  }

  Future<void> remove(String entryId) async {
    await _api.remove(entryId);
    notifyListeners();
  }
}
