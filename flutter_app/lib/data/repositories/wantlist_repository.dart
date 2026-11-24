import 'package:flutter/foundation.dart';

import '../../domain/models/paged.dart';
import '../../domain/models/wantlist/add_to_wantlist_result.dart';
import '../../domain/models/wantlist/want_entry.dart';
import '../../domain/models/wantlist/want_entry_detail.dart';
import '../../domain/api_exception.dart';
import '../services/wantlist_api.dart';

/// The user's Discogs wantlist ("wishlist" in the UI). Notifies after every
/// successful mutation. Throws `ApiException`.
class WantlistRepository extends ChangeNotifier {
  WantlistRepository({required this._api});

  final WantlistApi _api;

  Future<Paged<WantEntry>> list({int page = 1, bool refresh = false}) =>
      _api.list(page: page, pageSize: 20, refresh: refresh);

  /// Null when the release is not in the wantlist (404).
  Future<WantEntryDetail?> get(int releaseId) async {
    try {
      return await _api.get(releaseId);
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<AddToWantlistResult> add(int releaseId) async {
    final result = await _api.add(releaseId);
    notifyListeners();
    return result;
  }

  /// `rating: 0` clears the rating, `notes: ''` clears the notes.
  Future<WantEntryDetail> update(
    int releaseId, {
    int? rating,
    String? notes,
  }) async {
    final detail = await _api.update(releaseId, {
      'rating': ?rating,
      'notes': ?notes,
    });
    notifyListeners();
    return detail;
  }

  Future<void> remove(int releaseId) async {
    await _api.remove(releaseId);
    notifyListeners();
  }
}
