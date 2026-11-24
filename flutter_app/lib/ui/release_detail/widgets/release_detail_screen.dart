import 'package:material_ui/material_ui.dart';

import '../../core/widgets/error_retry_card.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/detail_status.dart';
import '../view_models/release_detail_view_model.dart';
import 'additional_info_section.dart';
import 'detail_back_button.dart';
import 'detail_layout.dart';
import 'detail_notice.dart';
import 'detail_scroll_view.dart';
import 'detail_skeleton.dart';
import 'rating_card.dart';
import 'relink_notice.dart';
import 'release_detail_actions.dart';
import 'release_details_section.dart';
import 'release_gallery.dart';
import 'streaming_links_section.dart';
import 'tracklist_section.dart';

/// `/releases/:id` (web `ReleaseDetailPage`).
class ReleaseDetailScreen extends StatefulWidget {
  const ReleaseDetailScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final ReleaseDetailViewModel Function() createViewModel;

  @override
  State<ReleaseDetailScreen> createState() => _ReleaseDetailScreenState();
}

class _ReleaseDetailScreenState extends State<ReleaseDetailScreen> {
  late final ReleaseDetailViewModel _vm = widget.createViewModel();

  @override
  void initState() {
    super.initState();
    _vm.load();
  }

  @override
  void dispose() {
    _vm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _vm,
    builder: (context, _) {
      const back = DetailBackButton(fallback: '/search');
      final release = _vm.release;
      if (_vm.status != DetailStatus.ready || release == null) {
        return switch (_vm.status) {
          DetailStatus.notFound => const DetailScrollView(
            children: [
              back,
              DetailNotice("Couldn't find that release in the catalog."),
            ],
          ),
          DetailStatus.relink => const DetailScrollView(
            children: [back, RelinkNotice()],
          ),
          DetailStatus.error => DetailScrollView(
            children: [
              back,
              ErrorRetryCard(
                message: "Couldn't load this release. Please try again.",
                onRetry: _vm.load,
              ),
            ],
          ),
          _ => DetailSkeleton(
            back: back,
            actions: ReleaseDetailActions(viewModel: _vm),
          ),
        };
      }
      final want = _vm.wantEntry;
      return DetailLayout(
        back: back,
        actions: ReleaseDetailActions(viewModel: _vm),
        gallery: VmCard(
          child: ReleaseGallery(images: release.images, alt: release.title),
        ),
        generalInfo: ReleaseDetailsSection(release: release),
        rating: RatingCard(
          community: release.community,
          personal: want == null
              ? null
              : (
                  value: want.rating,
                  status: _vm.ratingStatus,
                  onChanged: _vm.saveRating,
                  onRetry: _vm.retryRating,
                ),
        ),
        streaming: StreamingLinksSection(loader: _vm.streaming),
        tracklist: release.tracklist.isEmpty
            ? null
            : TracklistSection(tracklist: release.tracklist),
        catalogInfo: AdditionalInfoSection.hasContent(release)
            ? AdditionalInfoSection(release: release)
            : null,
      );
    },
  );
}
