import 'package:material_ui/material_ui.dart';

/// Web `Avatar`: square-ish user picture, neutral placeholder without one.
class VmAvatar extends StatelessWidget {
  const VmAvatar({
    super.key,
    this.url,
    required this.semanticLabel,
    this.size = 48,
  });

  final String? url;
  final String semanticLabel;
  final double size;

  @override
  Widget build(BuildContext context) {
    final placeholder = ColoredBox(
      color: Theme.of(context).colorScheme.surfaceContainerHigh,
    );
    return Semantics(
      image: true,
      label: semanticLabel,
      child: ClipRRect(
        borderRadius: const BorderRadius.all(Radius.circular(6)),
        child: SizedBox.square(
          dimension: size,
          child: url == null
              ? placeholder
              : Image.network(
                  url!,
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                  errorBuilder: (_, _, _) => placeholder,
                ),
        ),
      ),
    );
  }
}
