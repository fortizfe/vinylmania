import 'package:material_ui/material_ui.dart';

/// Scrolling page body of every detail state: padded column, 16 px gaps.
class DetailScrollView extends StatelessWidget {
  const DetailScrollView({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 16,
      children: children,
    ),
  );
}
