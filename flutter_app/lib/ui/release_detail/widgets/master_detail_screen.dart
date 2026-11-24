import 'package:material_ui/material_ui.dart';

import '../../core/widgets/error_retry_card.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/detail_status.dart';
import '../view_models/master_detail_view_model.dart';
import 'detail_back_button.dart';
import 'detail_layout.dart';
import 'detail_notice.dart';
import 'detail_scroll_view.dart';
import 'detail_skeleton.dart';
import 'master_details_section.dart';
import 'master_other_details_section.dart';
import 'master_versions_list.dart';
import 'relink_notice.dart';
import 'release_gallery.dart';
import 'streaming_links_section.dart';
import 'tracklist_section.dart';

/// `/masters/:id` (web `MasterReleaseDetailPage`).
class MasterDetailScreen extends StatefulWidget {
  const MasterDetailScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final MasterDetailViewModel Function() createViewModel;

  @override
  State<MasterDetailScreen> createState() => _MasterDetailScreenState();
}

class _MasterDetailScreenState extends State<MasterDetailScreen> {
  late final MasterDetailViewModel _vm = widget.createViewModel();

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
      final master = _vm.master;
      if (_vm.status != DetailStatus.ready || master == null) {
        return switch (_vm.status) {
          DetailStatus.notFound => const DetailScrollView(
            children: [
              back,
              DetailNotice("Couldn't find that master release in the catalog."),
            ],
          ),
          DetailStatus.relink => const DetailScrollView(
            children: [back, RelinkNotice()],
          ),
          DetailStatus.error => DetailScrollView(
            children: [
              back,
              ErrorRetryCard(
                message: "Couldn't load this master release. Please try again.",
                onRetry: _vm.load,
              ),
            ],
          ),
          _ => const DetailSkeleton(back: back),
        };
      }
      return DetailLayout(
        back: back,
        gallery: VmCard(
          child: ReleaseGallery(images: master.images, alt: master.title),
        ),
        generalInfo: MasterDetailsSection(master: master),
        catalogInfo: MasterOtherDetailsSection.hasContent(master)
            ? MasterOtherDetailsSection(master: master)
            : null,
        tracklist: master.tracklist.isEmpty
            ? null
            : TracklistSection(tracklist: master.tracklist),
        versions: MasterVersionsList(viewModel: _vm),
        streaming: StreamingLinksSection(loader: _vm.streaming),
      );
    },
  );
}
