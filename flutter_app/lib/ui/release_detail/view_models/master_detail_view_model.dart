import 'package:flutter/foundation.dart';

import '../../../data/repositories/catalog_repository.dart';
import '../../../data/repositories/streaming_repository.dart';
import '../../../domain/api_exception.dart';
import '../../../domain/models/catalog/master_release.dart';
import '../../../domain/models/catalog/master_release_version.dart';
import '../../../domain/models/paged.dart';
import 'detail_error.dart';
import 'detail_status.dart';
import 'streaming_links_loader.dart';

/// Master release detail (web `MasterReleaseDetailPage`): the master, its
/// paginated versions (fetched independently) and streaming links.
class MasterDetailViewModel extends ChangeNotifier {
  MasterDetailViewModel({
    required this.masterId,
    required this.catalogRepository,
    required this.streamingRepository,
  }) : streaming = StreamingLinksLoader(streamingRepository);

  /// A non-numeric route id arrives as 0: show the not-found state.
  final int masterId;
  final CatalogRepository catalogRepository;
  final StreamingRepository streamingRepository;
  final StreamingLinksLoader streaming;

  bool _disposed = false;

  DetailStatus status = DetailStatus.loading;
  MasterRelease? master;

  DetailStatus versionsStatus = DetailStatus.loading;
  int versionsPage = 1;
  Paged<MasterReleaseVersion>? versions;

  Future<void> load() async {
    if (masterId <= 0) {
      status = DetailStatus.notFound;
      notifyListeners();
      return;
    }
    status = DetailStatus.loading;
    notifyListeners();
    final versionsLoaded = goToVersionsPage(versionsPage);
    try {
      master = await catalogRepository.getMaster(masterId);
      status = DetailStatus.ready;
    } on ApiException catch (e) {
      status = detailStatusFor(e);
    }
    notifyListeners();
    final loaded = master;
    if (loaded != null && !_disposed) {
      // A master carries no identifiers: artist + title search only.
      streaming.load(
        artist: loaded.artists.firstOrNull?.name,
        title: loaded.title,
      );
    }
    await versionsLoaded;
  }

  Future<void> goToVersionsPage(int page) async {
    versionsPage = page;
    versionsStatus = DetailStatus.loading;
    notifyListeners();
    try {
      versions = await catalogRepository.getMasterVersions(
        masterId,
        page: page,
      );
      versionsStatus = DetailStatus.ready;
    } on ApiException catch (e) {
      versionsStatus = e.code == 'discogs_link_invalid'
          ? DetailStatus.relink
          : DetailStatus.error;
    }
    notifyListeners();
  }

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
