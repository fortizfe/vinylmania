import 'package:material_ui/material_ui.dart';

import 'article_grid.dart';

/// The front page's grid (web `Portada` classes), shared by the loaded view
/// and its skeleton. Wide: lead in 7 of 12 columns beside the 2×2 tiles, a
/// two-column "Latest". Narrow: lead, 2×2 tiles, one-column "Latest".
class PortadaFrame extends StatelessWidget {
  const PortadaFrame({
    super.key,
    required this.wide,
    required this.lead,
    required this.tiles,
    required this.rows,
  });

  final bool wide;
  final Widget? lead;
  final List<Widget> tiles;
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tileGrid = tiles.isEmpty
        ? const SizedBox.shrink()
        : ArticleGrid(columns: 2, children: tiles);
    final lead = this.lead;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (lead != null) ...[
          if (wide)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 7, child: lead),
                const SizedBox(width: 32),
                Expanded(flex: 5, child: tileGrid),
              ],
            )
          else ...[
            lead,
            if (tiles.isNotEmpty) ...[const SizedBox(height: 20), tileGrid],
          ],
          if (rows.isNotEmpty) const SizedBox(height: 32),
        ],
        if (rows.isNotEmpty) ...[
          Semantics(
            header: true,
            child: Text(
              'Latest',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurface,
              ),
            ),
          ),
          const SizedBox(height: 16),
          ArticleGrid(
            columns: wide ? 2 : 1,
            gap: wide ? 32 : 16,
            runGap: wide ? 20 : 16,
            children: rows,
          ),
        ],
      ],
    );
  }
}
