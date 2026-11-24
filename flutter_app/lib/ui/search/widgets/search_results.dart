import 'package:material_ui/material_ui.dart';

import '../../../domain/models/catalog/catalog_search_result.dart';
import '../../core/widgets/error_retry_card.dart';
import '../view_models/search_view_model.dart';
import 'result_card_actions.dart';
import 'search_relink_notice.dart';
import 'search_result_card.dart';
import 'search_result_card_skeleton.dart';
import 'search_result_list_row.dart';
import 'search_result_list_row_skeleton.dart';
import '../../core/widgets/view_mode.dart';
import '../view_models/results_state.dart';

/// Results in a grid (2 columns compact, 4–5 expanded) or list, with
/// skeletons in the same cells for the first and every next page. Loads the
/// next page 600 px before the end.
class SearchResults extends StatelessWidget {
  const SearchResults({
    super.key,
    required this.viewModel,
    required this.viewMode,
    required this.expanded,
    required this.padding,
    required this.onOpen,
  });

  final SearchViewModel viewModel;
  final ViewMode viewMode;
  final bool expanded;
  final EdgeInsets padding;
  final ValueChanged<String> onOpen;

  static const _skeletonCount = 8;
  static const _gap = 16.0;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    final muted = TextStyle(
      color: Theme.of(context).colorScheme.onSurfaceVariant,
    );
    Widget text(String value, {TextAlign? align}) => SliverToBoxAdapter(
      child: Text(value, style: muted, textAlign: align),
    );

    final slivers = switch (vm.resultsState) {
      ResultsState.idle => [
        text(
          'Use the search box above to look up a record in the Discogs '
          'catalog.',
        ),
      ],
      ResultsState.loading => [_cells(context, _skeletonCount, null)],
      ResultsState.error => [
        SliverToBoxAdapter(
          child: ErrorRetryCard(
            message: 'Something went wrong while searching. Please try again.',
            onRetry: vm.retry,
          ),
        ),
      ],
      ResultsState.relink => [
        const SliverToBoxAdapter(child: SearchRelinkNotice()),
      ],
      ResultsState.loaded when vm.results.isEmpty => [text(vm.emptyMessage)],
      ResultsState.loaded => [
        _cells(context, vm.results.length, vm.results),
        if (vm.isLoadingMore) ...[
          const SliverToBoxAdapter(child: SizedBox(height: _gap)),
          _cells(context, _skeletonCount, null),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: _gap)),
        if (vm.loadMoreFailed)
          SliverToBoxAdapter(
            child: ErrorRetryCard(
              message:
                  'Something went wrong while loading more results. Please '
                  'try again.',
              onRetry: vm.retryLoadMore,
            ),
          )
        else if (!vm.hasMore && !vm.isLoadingMore)
          text('No more results.', align: TextAlign.center),
      ],
    };

    return NotificationListener<Notification>(
      onNotification: (n) {
        final metrics = switch (n) {
          ScrollNotification(:final metrics) => metrics,
          ScrollMetricsNotification(:final metrics) => metrics,
          _ => null,
        };
        if (metrics != null && metrics.extentAfter < 600) vm.loadMore();
        return false;
      },
      child: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: padding.copyWith(top: 16, bottom: 24),
            sliver: SliverMainAxisGroup(slivers: slivers),
          ),
        ],
      ),
    );
  }

  /// [results] null → skeleton cells.
  Widget _cells(
    BuildContext context,
    int count,
    List<CatalogSearchResult>? results,
  ) {
    Widget cell(int i) {
      final r = results?[i];
      if (viewMode == ViewMode.list) {
        return r == null
            ? const SearchResultListRowSkeleton()
            : SearchResultListRow(
                result: r,
                onOpen: () => onOpen(
                  SearchViewModel.detailPath(r.resultType, r.discogsId),
                ),
                actions: _actions(r),
              );
      }
      return r == null
          ? const SearchResultCardSkeleton()
          : SearchResultCard(
              result: r,
              onOpen: () =>
                  onOpen(SearchViewModel.detailPath(r.resultType, r.discogsId)),
              actions: _actions(r),
            );
    }

    if (viewMode == ViewMode.list) {
      return SliverList.separated(
        itemCount: count,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, i) => cell(i),
      );
    }
    final scaler = MediaQuery.textScalerOf(context);
    return SliverLayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.crossAxisExtent;
        final columns = !expanded ? 2 : (width >= 1100 ? 5 : 4);
        final cellWidth = (width - _gap * (columns - 1)) / columns;
        return SliverGrid.builder(
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: _gap,
            crossAxisSpacing: _gap,
            // Square cover + three text lines + the 48 px actions row.
            mainAxisExtent:
                cellWidth + scaler.scale(64) + kMinInteractiveDimension + 32,
          ),
          itemCount: count,
          itemBuilder: (_, i) => cell(i),
        );
      },
    );
  }

  ResultCardActions? _actions(CatalogSearchResult r) {
    if (r.resultType == 'master') return null;
    final vm = viewModel;
    final id = r.discogsId;
    return ResultCardActions(
      adding: vm.isAddingToLibrary(id),
      added: vm.isInLibrary(id),
      onAdd: () => vm.addToLibrary(id),
      addingToWishlist: vm.isAddingToWishlist(id),
      inWishlist: vm.isInWishlist(id),
      onAddToWishlist: () => vm.addToWishlist(id),
    );
  }
}
