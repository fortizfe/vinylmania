import 'package:material_ui/material_ui.dart';

/// Muted status text announced when it appears (web `role="status"`).
class StatusLine extends StatelessWidget {
  const StatusLine(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Text(
      text,
      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
    ),
  );
}
