import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/pressable.dart';

/// Web `BackLink`: pops when there is history, else goes to [fallback].
class DetailBackButton extends StatelessWidget {
  const DetailBackButton({super.key, required this.fallback});

  final String fallback;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurfaceVariant;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Pressable(
        onTap: () => context.canPop() ? context.pop() : context.go(fallback),
        semanticLabel: 'Back',
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinInteractiveDimension,
            minWidth: kMinInteractiveDimension,
          ),
          child: ExcludeSemantics(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.chevron_left, size: 20, color: color),
                Text(
                  'Back',
                  style: Theme.of(context).textTheme.labelLarge
                      ?.copyWith(color: color),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
