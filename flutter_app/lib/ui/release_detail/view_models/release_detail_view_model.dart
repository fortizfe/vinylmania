import 'package:flutter/foundation.dart';

import '../../../data/repositories/catalog_repository.dart';
import '../../../data/repositories/library_repository.dart';
import '../../../data/repositories/streaming_repository.dart';
import '../../../data/repositories/wantlist_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/models/catalog/release.dart';
import '../../../domain/models/wantlist/want_entry_detail.dart';
import 'detail_error.dart';
import 'detail_status.dart';
import 'save_status.dart';
import 'streaming_links_loader.dart';
import '../../../domain/models/library/wantlist_removal.dart';

/// Release detail (web `ReleaseDetailPage`): the release, its wantlist
/// membership (personal rating), the add actions and streaming links.
class ReleaseDetailViewModel extends ChangeNotifier {
  ReleaseDetailViewModel({
    required this.releaseId,
    required this.catalogRepository,
    required this.libraryRepository,
    required this.wantlistRepository,
    required this.streamingRepository,
  }) : streaming = StreamingLinksLoader(streamingRepository);

  /// A non-numeric route id arrives as 0: show the not-found state.
  final int releaseId;
  final CatalogRepository catalogRepository;
  final LibraryRepository libraryRepository;
  final WantlistRepository wantlistRepository;
  final StreamingRepository streamingRepository;
  final StreamingLinksLoader streaming;

  static const _removalFailedNotice =
      "Added to your library. We couldn't remove it from your wishlist — "
      'remove it there when you can.';

  bool _disposed = false;
  int? _lastRatingAttempt;

  DetailStatus status = DetailStatus.loading;
  Release? release;
  WantEntryDetail? wantEntry;
  bool get isInWantlist => wantEntry != null;

  bool addingToLibrary = false;
  bool addedToLibrary = false;
  bool addingToWishlist = false;
  bool addedToWishlist = false;
  String? notice;
  String? libraryError;
  String? wishlistError;

  /// The Discogs gate tripped by an add action (`DiscogsLinkGate` args).
  ({bool relink, String context})? gate;
  SaveStatus ratingStatus = SaveStatus.idle;

  Future<void> load() async {
    if (releaseId <= 0) {
      status = DetailStatus.notFound;
      notifyListeners();
      return;
    }
    status = DetailStatus.loading;
    notifyListeners();
    final want = _fetchWantEntry();
    try {
      release = await catalogRepository.getRelease(releaseId);
      status = DetailStatus.ready;
    } on ApiException catch (e) {
      status = detailStatusFor(e);
    }
    wantEntry = await want;
    notifyListeners();
    final loaded = release;
    if (loaded == null || _disposed) return;
    streaming.load(
      barcodes: [
        for (final id in loaded.identifiers)
          if (id.type == 'Barcode') id.value,
      ],
      artist: loaded.artists.firstOrNull?.name,
      title: loaded.title,
    );
  }

  /// Null when not in the wantlist or the lookup failed (web: query error).
  Future<WantEntryDetail?> _fetchWantEntry() async {
    try {
      return await wantlistRepository.get(releaseId);
    } on ApiException {
      return null;
    }
  }

  Future<void> addToLibrary() async {
    if (addingToLibrary) return;
    libraryError = null;
    gate = null;
    notice = null;
    addingToLibrary = true;
    notifyListeners();
    try {
      final entry = await libraryRepository.add(releaseId);
      addedToLibrary = true;
      if (entry.wantlistRemoval == WantlistRemoval.failed) {
        notice = _removalFailedNotice;
      }
      if (entry.wantlistRemoval == WantlistRemoval.removed) wantEntry = null;
    } on ApiException catch (e) {
      gate = _gateFor(e, 'add-to-library');
      if (gate == null) {
        libraryError =
            'Something went wrong while adding this record. Please try again.';
      }
    }
    addingToLibrary = false;
    notifyListeners();
  }

  Future<void> addToWishlist() async {
    if (addingToWishlist) return;
    wishlistError = null;
    gate = null;
    notice = null;
    addingToWishlist = true;
    notifyListeners();
    try {
      final result = await wantlistRepository.add(releaseId);
      addedToWishlist = true;
      notice = result.alreadyInLibrary
          ? 'This is already in your library.'
          : 'Added to your wishlist.';
      wantEntry = await _fetchWantEntry();
    } on ApiException catch (e) {
      gate = _gateFor(e, 'add-to-wishlist');
      if (gate == null) {
        wishlistError =
            'Something went wrong while adding this record to your wishlist. '
            'Please try again.';
      }
    }
    addingToWishlist = false;
    notifyListeners();
  }

  /// Personal rating, only while the release is in the wantlist. A failed
  /// save keeps the persisted value (the stars snap back).
  Future<void> saveRating(int rating) async {
    if (wantEntry == null) return;
    _lastRatingAttempt = rating;
    ratingStatus = SaveStatus.saving;
    notifyListeners();
    try {
      wantEntry = await wantlistRepository.update(releaseId, rating: rating);
      ratingStatus = SaveStatus.idle;
    } on ApiException {
      ratingStatus = SaveStatus.failed;
    }
    notifyListeners();
  }

  Future<void> retryRating() async {
    final rating = _lastRatingAttempt;
    if (rating != null) await saveRating(rating);
  }

  static ({bool relink, String context})? _gateFor(
    ApiException e,
    String context,
  ) => switch (e.code) {
    'discogs_not_linked' => (relink: false, context: context),
    'discogs_link_invalid' => (relink: true, context: context),
    _ => null,
  };

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    streaming.dispose();
    super.dispose();
  }
}
