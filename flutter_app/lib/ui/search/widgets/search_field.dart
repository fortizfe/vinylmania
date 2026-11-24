import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_text_field.dart';

/// Search input + submit button (web `HeaderSearchBox` form). Esc closes the
/// suggestions; the polite live region carries the panel announcement.
class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.autofocus,
    required this.announcement,
    required this.onChanged,
    required this.onSubmitted,
    required this.onEscape,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool autofocus;
  final String announcement;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onEscape;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: CallbackShortcuts(
            bindings: {
              const SingleActivator(LogicalKeyboardKey.escape): onEscape,
            },
            child: VmTextField(
              label: 'Search Discogs',
              hintText: 'Search Discogs…',
              prefixIcon: Icons.search,
              controller: controller,
              focusNode: focusNode,
              autofocus: autofocus,
              textInputAction: TextInputAction.search,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
            ),
          ),
        ),
        const SizedBox(width: 8),
        TextFieldTapRegion(
          child: VmButton.icon(
            onPressed: () => onSubmitted(controller.text),
            label: 'Search',
            icon: Icons.arrow_forward,
          ),
        ),
        Semantics(
          liveRegion: true,
          label: announcement,
          child: const SizedBox.square(dimension: 1),
        ),
      ],
    );
  }
}
