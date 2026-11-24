import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/confirm_dialog.dart';
import '../../core/widgets/error_retry_card.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/copy_field.dart';
import '../view_models/detail_status.dart';
import '../view_models/record_detail_view_model.dart';
import 'additional_info_section.dart';
import 'detail_back_button.dart';
import 'detail_layout.dart';
import 'detail_notice.dart';
import 'detail_scroll_view.dart';
import 'detail_skeleton.dart';
import 'my_copy_section.dart';
import 'rating_card.dart';
import 'record_detail_actions.dart';
import 'relink_notice.dart';
import 'release_details_section.dart';
import 'release_gallery.dart';
import 'streaming_links_section.dart';
import 'tracklist_section.dart';

/// `/library/records/:entryId` (web `RecordDetailPage`).
class RecordDetailScreen extends StatefulWidget {
  const RecordDetailScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final RecordDetailViewModel Function() createViewModel;

  @override
  State<RecordDetailScreen> createState() => _RecordDetailScreenState();
}

class _RecordDetailScreenState extends State<RecordDetailScreen> {
  late final RecordDetailViewModel _vm = widget.createViewModel();

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

  Future<void> _remove() async {
    final confirmed = await ConfirmDialog.show(
      context,
      title: 'Remove from library',
      message: 'Remove this record from your library? This cannot be undone.',
      confirmLabel: 'Remove',
    );
    if (!confirmed || !await _vm.remove() || !mounted) return;
    context.canPop() ? context.pop() : context.go('/library');
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _vm,
    builder: (context, _) {
      const back = DetailBackButton(fallback: '/library');
      final actions = RecordDetailActions(
        onRemove: _remove,
        removing: _vm.removing,
        removeError: _vm.removeError,
      );
      switch (_vm.status) {
        case DetailStatus.loading:
          return DetailSkeleton(back: back, actions: actions);
        case DetailStatus.notFound:
          return const DetailScrollView(
            children: [
              back,
              DetailNotice("Couldn't find that record in your library."),
            ],
          );
        case DetailStatus.relink:
          return const DetailScrollView(children: [back, RelinkNotice()]);
        case DetailStatus.error:
          return DetailScrollView(
            children: [
              back,
              ErrorRetryCard(
                message: "Couldn't load this record. Please try again.",
                onRetry: _vm.load,
              ),
            ],
          );
        case DetailStatus.ready:
          break;
      }
      final myCopy = MyCopySection(viewModel: _vm);
      final release = _vm.release;
      if (release == null) {
        // Catalog details are gone, but the copy stays editable/removable.
        return DetailScrollView(
          children: [
            back,
            actions,
            const DetailNotice(
              "Couldn't load catalog details for this record right now.",
            ),
            myCopy,
          ],
        );
      }
      final copy = _vm.copy;
      return DetailLayout(
        back: back,
        actions: actions,
        gallery: VmCard(
          child: ReleaseGallery(images: release.images, alt: release.title),
        ),
        generalInfo: ReleaseDetailsSection(release: release),
        myCopy: myCopy,
        rating: RatingCard(
          community: release.community,
          personal: copy == null
              ? null
              : (
                  value: copy.rating,
                  status: _vm.statusOf(CopyField.rating),
                  onChanged: _vm.saveRating,
                  onRetry: () => _vm.retry(CopyField.rating),
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
