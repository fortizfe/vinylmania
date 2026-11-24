import 'package:material_ui/material_ui.dart';

/// Error text announced when it appears (web `role="alert"`).
class ErrorLine extends StatelessWidget {
  const ErrorLine(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Text(
      text,
      style: TextStyle(color: Theme.of(context).colorScheme.error),
    ),
  );
}
