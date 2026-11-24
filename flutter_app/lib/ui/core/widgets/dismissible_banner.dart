import 'package:material_ui/material_ui.dart';

import '../theme/vinylmania_colors.dart';
import 'pressable.dart';
import 'banner_tone.dart';

/// Profile `DismissibleBanner`: an announced outcome message with a
/// Dismiss button.
class DismissibleBanner extends StatelessWidget {
  const DismissibleBanner({
    super.key,
    required this.text,
    required this.tone,
    required this.onDismiss,
  });

  final String text;
  final BannerTone tone;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = VinylmaniaColors.of(context);
    final (background, foreground, border) = switch (tone) {
      BannerTone.success => (
        scheme.surfaceContainer,
        scheme.onSurface,
        scheme.outlineVariant,
      ),
      BannerTone.warning => (
        colors.warningSurface,
        colors.onWarningSurface,
        colors.warningBorder,
      ),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
        borderRadius: const BorderRadius.all(Radius.circular(12)),
      ),
      child: Padding(
        padding: const EdgeInsets.only(left: 16, top: 4, bottom: 4, right: 4),
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                liveRegion: true,
                child: Text(text, style: TextStyle(color: foreground)),
              ),
            ),
            Pressable(
              onTap: onDismiss,
              semanticLabel: 'Dismiss',
              child: SizedBox.square(
                dimension: kMinInteractiveDimension,
                child: Icon(Icons.close, size: 20, color: foreground),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
