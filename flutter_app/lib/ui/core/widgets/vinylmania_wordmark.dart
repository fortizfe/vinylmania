import 'package:material_ui/material_ui.dart';

/// The Anton "VINYLMANIA" wordmark (web `VinylmaniaWordmark`, no grunge).
class VinylmaniaWordmark extends StatelessWidget {
  const VinylmaniaWordmark({super.key, this.fontSize = 24});

  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      label: 'Vinylmania',
      child: ExcludeSemantics(
        child: Text(
          'VINYLMANIA',
          maxLines: 1,
          softWrap: false,
          style: theme.textTheme.displaySmall?.copyWith(
            fontSize: fontSize,
            letterSpacing: -0.02 * fontSize,
            color: theme.colorScheme.onSurface,
          ),
        ),
      ),
    );
  }
}
