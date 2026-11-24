import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/page_title.dart';
import '../view_models/search_view_model.dart';
import 'search_feedback.dart';
import 'search_field.dart';
import 'search_results.dart';
import 'search_toolbar.dart';
import 'suggestion_panel.dart';
import '../../core/widgets/view_mode.dart';
import '../view_models/suggestion_state.dart';

/// Search tab (web `HeaderSearchBox` + `SearchResultsPage`): the field on
/// top, suggestions replacing the results while the user types.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final SearchViewModel Function() createViewModel;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  late final SearchViewModel _viewModel = widget.createViewModel();
  // ponytail: in memory, like Library; persist when a preferences store
  // exists in the app.
  ViewMode _viewMode = ViewMode.grid;
  late final _controller = TextEditingController(text: _viewModel.query);
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      if (!_focusNode.hasFocus) _viewModel.closeSuggestions();
    });
    _viewModel.load();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _open(String location) => context.push(location);

  void _submit(String text) {
    _viewModel.submit(text);
    _focusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final expanded = MediaQuery.sizeOf(context).width >= 840;
    final padding = EdgeInsets.symmetric(horizontal: expanded ? 32 : 16);
    return ListenableBuilder(
      listenable: _viewModel,
      builder: (context, _) {
        final vm = _viewModel;
        final suggesting = vm.suggestionState != SuggestionState.idle;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: padding.copyWith(top: expanded ? 32 : 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (expanded) ...[
                    const PageTitle('Search'),
                    const SizedBox(height: 16),
                  ],
                  SearchField(
                    controller: _controller,
                    focusNode: _focusNode,
                    autofocus: vm.query.isEmpty,
                    announcement: vm.suggestionAnnouncement,
                    onChanged: vm.onFieldChanged,
                    onSubmitted: _submit,
                    onEscape: vm.closeSuggestions,
                  ),
                  const SizedBox(height: 12),
                  SearchToolbar(
                    filters: vm.filters,
                    onFiltersChanged: vm.setFilters,
                    onClear: vm.clearFilters,
                    viewMode: _viewMode,
                    onViewModeChanged: (mode) =>
                        setState(() => _viewMode = mode),
                  ),
                  SearchFeedback(
                    gate: vm.gate,
                    notice: vm.notice,
                    error: vm.actionError,
                  ),
                ],
              ),
            ),
            Expanded(
              child: suggesting
                  ? TextFieldTapRegion(
                      child: SuggestionPanel(
                        viewModel: vm,
                        padding: padding,
                        onOpen: _open,
                      ),
                    )
                  : SearchResults(
                      viewModel: vm,
                      viewMode: _viewMode,
                      expanded: expanded,
                      padding: padding,
                      onOpen: _open,
                    ),
            ),
          ],
        );
      },
    );
  }
}
