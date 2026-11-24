import 'package:material_ui/material_ui.dart';

/// A lazily built grid whose rows size to their tallest cell, so cards never
/// clip at large text sizes. Columns fit as many [minTileWidth] tiles as the
/// width allows (infinity → a one-column list).
///
/// [onEndReached] fires after the last row is built, i.e. once it enters the
/// viewport's cache extent: the next batch starts before the user hits the
/// end, and a tall window keeps filling itself (web D9 sentinel).
class CardGridSliver extends StatelessWidget {
  const CardGridSliver({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    required this.minTileWidth,
    this.onEndReached,
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final double minTileWidth;
  final VoidCallback? onEndReached;

  static const _gap = 16.0;

  @override
  Widget build(BuildContext context) {
    return SliverLayoutBuilder(
      builder: (context, constraints) {
        final columns =
            ((constraints.crossAxisExtent + _gap) ~/ (minTileWidth + _gap))
                .clamp(1, 1 << 20);
        final rows = (itemCount / columns).ceil();
        return SliverList.separated(
          itemCount: rows,
          separatorBuilder: (_, _) => const SizedBox(height: _gap),
          itemBuilder: (context, row) {
            if (row == rows - 1 && onEndReached != null) {
              WidgetsBinding.instance.addPostFrameCallback(
                (_) => onEndReached!(),
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: _gap,
              children: [
                for (var col = 0; col < columns; col++)
                  Expanded(
                    child: row * columns + col < itemCount
                        ? itemBuilder(context, row * columns + col)
                        : const SizedBox.shrink(),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}
