import 'package:material_ui/material_ui.dart';

import 'detail_scroll_view.dart';

/// Web `RecordDetailLayout`. Compact: one column in the web's mobile order.
/// Expanded (≥ 840): a narrow media rail (gallery, rating, streaming) beside
/// the liner notes (info, my copy, tracklist, catalog info, versions), each
/// column stacking independently.
class DetailLayout extends StatelessWidget {
  const DetailLayout({
    super.key,
    required this.back,
    this.actions,
    required this.gallery,
    required this.generalInfo,
    this.myCopy,
    this.rating,
    required this.streaming,
    this.tracklist,
    this.catalogInfo,
    this.versions,
  });

  final Widget back;
  final Widget? actions;
  final Widget gallery;
  final Widget generalInfo;
  final Widget? myCopy;
  final Widget? rating;
  final Widget streaming;
  final Widget? tracklist;
  final Widget? catalogInfo;
  final Widget? versions;

  static const _railWidth = 380.0;

  @override
  Widget build(BuildContext context) {
    final top = [back, ?actions];
    if (MediaQuery.sizeOf(context).width < 840) {
      return DetailScrollView(
        children: [
          ...top,
          gallery,
          generalInfo,
          ?myCopy,
          ?rating,
          streaming,
          ?tracklist,
          ?catalogInfo,
          ?versions,
        ],
      );
    }
    Widget column(List<Widget> children) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 16,
      children: children,
    );
    return DetailScrollView(
      children: [
        ...top,
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 16,
          children: [
            SizedBox(
              width: _railWidth,
              child: column([gallery, ?rating, streaming]),
            ),
            Expanded(
              child: column([
                generalInfo,
                ?myCopy,
                ?tracklist,
                ?catalogInfo,
                ?versions,
              ]),
            ),
          ],
        ),
      ],
    );
  }
}
