import 'package:material_ui/material_ui.dart';

/// "D" mark, title and description of the Discogs card.
class DiscogsCardHeading extends StatelessWidget {
  const DiscogsCardHeading({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Row(
      children: [
        ExcludeSemantics(
          child: CircleAvatar(
            radius: 20,
            backgroundColor: scheme.inverseSurface,
            child: Text(
              'D',
              style: TextStyle(
                color: scheme.onInverseSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(
                  'Discogs',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: scheme.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                'Link your Vinylmania account with your Discogs account.',
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
