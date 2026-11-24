import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vinylmania_wordmark.dart';

/// Wordmark + tagline (web `LandingHero`, condensed).
class SignInHero extends StatelessWidget {
  const SignInHero({super.key, this.wordmarkSize = 48});

  final double wordmarkSize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      header: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: VinylmaniaWordmark(fontSize: wordmarkSize),
          ),
          const SizedBox(height: 12),
          Container(
            width: 48,
            height: 4,
            decoration: BoxDecoration(
              color: theme.colorScheme.primary,
              borderRadius: const BorderRadius.all(Radius.circular(2)),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Track your collection with Discogs, rate every record, and follow '
            'curated rock and metal news — all in one place.',
            style: theme.textTheme.titleMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
