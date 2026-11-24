import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_card.dart';
import 'detail_layout.dart';

/// Web `RecordDetailSkeleton`: the same [DetailLayout] filled with
/// placeholders, so loading → content keeps the footprint.
class DetailSkeleton extends StatelessWidget {
  const DetailSkeleton({super.key, required this.back, this.actions});

  final Widget back;

  /// The screen's action row: laid out but hidden, so it takes the same
  /// space it will once loaded.
  final Widget? actions;

  static Widget _card(List<Widget> children) => VmCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 12,
      children: children,
    ),
  );

  @override
  Widget build(BuildContext context) => DetailLayout(
    back: back,
    actions: actions == null
        ? null
        : Visibility(
            visible: false,
            maintainSize: true,
            maintainAnimation: true,
            maintainState: true,
            child: actions!,
          ),
    gallery: VmCard(
      child: const AspectRatio(
        aspectRatio: 1,
        child: Skeleton(height: double.infinity),
      ),
    ),
    generalInfo: _card(const [
      Skeleton(width: 240, height: 32),
      Skeleton(width: 120),
      Skeleton(),
      Skeleton(),
    ]),
    rating: _card(const [
      Skeleton(width: 112, height: 24),
      Skeleton(width: 144),
      Skeleton(width: 112, height: 32),
      Skeleton(width: 96),
      Skeleton(width: 240, height: 48),
    ]),
    streaming: _card(const [
      Skeleton(width: 176, height: 24),
      Skeleton(width: 144, height: 48),
    ]),
    tracklist: _card([
      const Skeleton(width: 128, height: 24),
      for (var i = 0; i < 6; i++) const Skeleton(),
    ]),
  );
}
