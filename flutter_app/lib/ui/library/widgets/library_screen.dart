import 'package:flutter/semantics.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/discogs_link_gate.dart';
import '../../core/widgets/error_retry_card.dart';
import '../../core/widgets/page_title.dart';
import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/library_view_model.dart';
import 'card_grid_sliver.dart';
import 'library_toolbar.dart';
import 'record_card.dart';
import 'record_card_skeleton.dart';
import 'record_list_row.dart';
import 'record_list_row_skeleton.dart';
import '../../core/widgets/view_mode.dart';

/// Web `LibraryListPage`. Compact and expanded differ in padding, toolbar
/// (sheet vs sort menu + filters dialog) and grid columns.
class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key, required this.createViewModel});

  /// Called once, when the screen mounts; the screen owns the result.
  final LibraryViewModel Function() createViewModel;

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  late final LibraryViewModel _vm = widget.createViewModel();

  // ponytail: in memory, like a fresh tab; the web keeps it in localStorage.
  // Persist when a preferences store exists in the app.
  ViewMode _mode = ViewMode.grid;

  @override
  void initState() {
    super.initState();
    _vm.addListener(_announce);
    _vm.load();
  }

  @override
  void dispose() {
    _vm.removeListener(_announce);
    _vm.dispose();
    super.dispose();
  }

  void _announce() {
    final message = _vm.takeAnnouncement();
    if (message == null || !mounted) return;
    SemanticsService.sendAnnouncement(
      View.of(context),
      message,
      Directionality.of(context),
    );
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 840;
    final pad = compact ? 16.0 : 32.0;
    return ListenableBuilder(
      listenable: _vm,
      builder: (context, _) {
        if (_vm.isGated) {
          return ListView(
            padding: EdgeInsets.all(pad),
            children: [
              const PageTitle('Your library'),
              const SizedBox(height: 24),
              DiscogsLinkGate(relink: _vm.needsRelink, context: 'library'),
            ],
          );
        }
        final theme = Theme.of(context);
        final muted = TextStyle(color: theme.colorScheme.onSurfaceVariant);
        final error = TextStyle(color: theme.colorScheme.error);
        final entries = _vm.entries;
        final showList =
            _vm.loadError == null && (_vm.isLoading || entries.isNotEmpty);
        final skeletons = _vm.isLoading ? 8 : (_vm.isLoadingMore ? 4 : 0);
        final list = _mode == ViewMode.list;
        final canLoadMore =
            _vm.hasMore &&
            !_vm.isLoading &&
            !_vm.isLoadingMore &&
            !_vm.loadMoreFailed;

        return CustomScrollView(
          slivers: [
            SliverPadding(
              padding: EdgeInsets.fromLTRB(pad, pad, pad, 16),
              sliver: SliverList.list(
                children: [
                  Row(
                    children: [
                      const Expanded(child: PageTitle('Your library')),
                      const SizedBox(width: 16),
                      VmButton.secondary(
                        onPressed: _vm.refresh,
                        loading: _vm.isRefreshing,
                        label: 'Refresh',
                      ),
                    ],
                  ),
                  if (_vm.loadError == null)
                    // Laid out while loading too: no shift when it appears.
                    Visibility(
                      visible: !_vm.isLoading,
                      maintainSize: true,
                      maintainAnimation: true,
                      maintainState: true,
                      child: Text(
                        '${_vm.totalItems} '
                        '${_vm.totalItems == 1 ? 'record' : 'records'}',
                        style: muted,
                      ),
                    ),
                  const SizedBox(height: 16),
                  LibraryToolbar(
                    viewModel: _vm,
                    mode: _mode,
                    onModeChanged: (mode) => setState(() => _mode = mode),
                  ),
                  if (_vm.refreshFailed) ...[
                    const SizedBox(height: 16),
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        "Couldn't refresh from Discogs right now. "
                        'Please try again.',
                        style: error,
                      ),
                    ),
                  ],
                  if (_vm.loadError != null) ...[
                    const SizedBox(height: 16),
                    ErrorRetryCard(
                      message:
                          'Something went wrong while loading your '
                          'library. Please try again.',
                      onRetry: _vm.load,
                    ),
                  ] else if (!_vm.isLoading && entries.isEmpty) ...[
                    const SizedBox(height: 16),
                    VmCard(
                      child: Text(
                        _vm.filters.isEmpty
                            ? 'No records yet. Add your first one to get '
                                  'started.'
                            : 'No results for the active filters. Try '
                                  'adjusting or clearing them.',
                        style: muted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (showList)
              SliverPadding(
                padding: EdgeInsets.symmetric(horizontal: pad),
                sliver: CardGridSliver(
                  itemCount: entries.length + skeletons,
                  minTileWidth: list ? double.infinity : (compact ? 160 : 200),
                  onEndReached: canLoadMore ? _vm.loadMore : null,
                  itemBuilder: (context, i) {
                    if (i >= entries.length) {
                      return list
                          ? const RecordListRowSkeleton()
                          : const RecordCardSkeleton();
                    }
                    final entry = entries[i];
                    void open() => context.push('/library/records/${entry.id}');
                    return list
                        ? RecordListRow(entry: entry, onTap: open)
                        : RecordCard(entry: entry, onTap: open);
                  },
                ),
              ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(pad, 16, pad, pad),
              sliver: SliverList.list(
                children: [
                  if (_vm.loadMoreFailed)
                    Column(
                      children: [
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            "Couldn't load more records. Please try again.",
                            style: error,
                          ),
                        ),
                        const SizedBox(height: 8),
                        VmButton.secondary(
                          onPressed: _vm.loadMore,
                          label: 'Retry',
                        ),
                      ],
                    )
                  else if (entries.isNotEmpty && !_vm.hasMore)
                    Text(
                      "You've reached the end of your collection — "
                      '${_vm.totalItems} '
                      '${_vm.totalItems == 1 ? 'record' : 'records'}',
                      textAlign: TextAlign.center,
                      style: muted,
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
