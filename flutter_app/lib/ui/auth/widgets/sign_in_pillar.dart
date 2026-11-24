import 'package:material_ui/material_ui.dart';

/// The three pillars of the web landing page, verbatim.
const signInPillars = [
  (
    icon: Icons.album_outlined,
    title: 'Your catalog, powered by Discogs',
    description: 'Every release is backed by Discogs metadata — accurate, always up to date.',
  ),
  (
    icon: Icons.star_outline_rounded,
    title: 'Personal ratings for every record',
    description: 'Score the records you love and keep track of your favorites over time.',
  ),
  (
    icon: Icons.newspaper_outlined,
    title: 'Curated rock and metal news',
    description: 'Stay current with hand-picked rock and metal stories from trusted sources.',
  ),
];

/// One landing pillar: icon, title, description.
class SignInPillar extends StatelessWidget {
  const SignInPillar({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: theme.colorScheme.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: theme.colorScheme.onSurface,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
