import 'package:material_ui/material_ui.dart';

/// Gives [child] the height of exactly [lines] lines of [style] at the
/// current text scale, so a card and its skeleton measure the same.
Widget reservedLines({
  required TextStyle? style,
  required int lines,
  required Widget child,
}) => Stack(
  children: [
    SizedBox(
      width: double.infinity,
      child: ExcludeSemantics(
        child: Opacity(
          opacity: 0,
          child: Text('\n' * (lines - 1), style: style, maxLines: lines),
        ),
      ),
    ),
    Positioned.fill(child: child),
  ],
);
