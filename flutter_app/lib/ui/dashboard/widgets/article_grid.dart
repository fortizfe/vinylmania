import 'package:material_ui/material_ui.dart';

/// [children] in [columns] equal columns, rows growing with their content.
class ArticleGrid extends StatelessWidget {
  const ArticleGrid({
    super.key,
    required this.columns,
    required this.children,
    this.gap = 16,
    this.runGap = 20,
  });

  final int columns;
  final List<Widget> children;
  final double gap;
  final double runGap;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = ((constraints.maxWidth - gap * (columns - 1)) / columns)
            .floorToDouble();
        return Wrap(
          spacing: gap,
          runSpacing: runGap,
          children: [
            for (final child in children) SizedBox(width: width, child: child),
          ],
        );
      },
    );
  }
}
