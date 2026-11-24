import 'package:material_ui/material_ui.dart';

import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_button.dart';
import '../view_models/search_view_model.dart';
import 'suggestion_row.dart';
import '../view_models/suggestion_state.dart';

/// Web `HeaderSuggestionPanel`: loading rows, suggestions, empty or error.
/// Every row is 56 px and the message block is as tall as five rows, so
/// the panel never resizes between states.
class SuggestionPanel extends StatelessWidget {
  const SuggestionPanel({
    super.key,
    required this.viewModel,
    required this.padding,
    required this.onOpen,
  });

  final SearchViewModel viewModel;
  final EdgeInsets padding;
  final ValueChanged<String> onOpen;

  static const rowHeight = 56.0;
  static const _rows = 5;
  static const _gap = 4.0;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    final muted = TextStyle(
      color: Theme.of(context).colorScheme.onSurfaceVariant,
    );
    Widget message(List<Widget> children) => ConstrainedBox(
      constraints: const BoxConstraints(
        minHeight: rowHeight * _rows + _gap * (_rows - 1),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: children,
      ),
    );

    final List<Widget> children = switch (vm.suggestionState) {
      SuggestionState.loading => [
        for (var i = 0; i < _rows; i++)
          const Skeleton(
            height: rowHeight,
            radius: BorderRadius.all(Radius.circular(8)),
          ),
      ],
      SuggestionState.suggestions => [
        for (final s in vm.suggestions)
          SuggestionRow(
            suggestion: s,
            onTap: () {
              final location = vm.pick(s);
              if (location != null) onOpen(location);
            },
          ),
      ],
      SuggestionState.empty => [
        message([
          Text(
            'No suggestions for “${vm.suggestionQuery}”. Try fewer or '
            'different words.',
            textAlign: TextAlign.center,
            style: muted,
          ),
        ]),
      ],
      SuggestionState.error => [
        message([
          Text(
            'Suggestions are unavailable right now.',
            textAlign: TextAlign.center,
            style: muted,
          ),
          const SizedBox(height: 12),
          VmButton.secondary(onPressed: vm.retrySuggestions, label: 'Retry'),
        ]),
      ],
      SuggestionState.idle => const [],
    };

    return Semantics(
      label: 'Search suggestions',
      container: true,
      child: ListView.separated(
        padding: padding.copyWith(top: 12, bottom: 16),
        itemCount: children.length,
        separatorBuilder: (_, _) => const SizedBox(height: _gap),
        itemBuilder: (_, i) => children[i],
      ),
    );
  }
}
