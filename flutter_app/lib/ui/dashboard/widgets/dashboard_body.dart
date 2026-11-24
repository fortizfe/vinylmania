import 'package:material_ui/material_ui.dart';

import '../../core/widgets/error_retry_card.dart';
import '../../core/widgets/page_title.dart';
import '../../core/widgets/skeleton.dart';
import '../view_models/dashboard_status.dart';
import '../view_models/dashboard_view_model.dart';
import '../view_models/portada_slots.dart';
import 'article_card.dart';
import 'article_card_skeleton.dart';
import 'article_card_variant.dart';
import 'portada_frame.dart';
import 'source_filter_bar.dart';

/// Title, source chips and the state below them; layouts only choose
/// [wide] and whether the chips scroll or wrap.
class DashboardBody extends StatelessWidget {
  const DashboardBody({
    super.key,
    required this.viewModel,
    required this.wide,
    required this.scrollableChips,
  });

  final DashboardViewModel viewModel;

  /// Lead beside the tiles and a two-column "Latest" (expanded).
  final bool wide;
  final bool scrollableChips;

  Widget _portada(PortadaSlots slots) => PortadaFrame(
    wide: wide,
    lead: slots.lead == null
        ? null
        : ArticleCard(article: slots.lead!, variant: ArticleCardVariant.lead),
    tiles: [for (final a in slots.secondary) ArticleCard(article: a)],
    rows: [
      for (final a in slots.latest)
        ArticleCard(article: a, variant: ArticleCardVariant.row),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = viewModel.status;
    Widget notice(String text) => Semantics(
      liveRegion: true,
      child: Text(
        text,
        style: theme.textTheme.bodyLarge?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
    final chips = status == DashboardStatus.allUnavailable
        ? null
        : viewModel.sources.isNotEmpty
        ? SourceFilterBar(
            sources: viewModel.sources,
            selectedSourceId: viewModel.selectedSourceId,
            onSelected: viewModel.selectSource,
            scrollable: scrollableChips,
          )
        : status == DashboardStatus.loading
        ? Wrap(
            spacing: 8,
            children: [
              for (final w in const [104.0, 128.0, 96.0])
                Skeleton(
                  width: w,
                  height: kMinInteractiveDimension,
                  radius: const BorderRadius.all(Radius.circular(999)),
                ),
            ],
          )
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const PageTitle('News'),
        const SizedBox(height: 16),
        if (chips != null) ...[chips, const SizedBox(height: 24)],
        switch (status) {
          DashboardStatus.loading => PortadaFrame(
            wide: wide,
            lead: const ArticleCardSkeleton(variant: ArticleCardVariant.lead),
            tiles: [for (var i = 0; i < 4; i++) const ArticleCardSkeleton()],
            rows: [
              for (var i = 0; i < 6; i++)
                const ArticleCardSkeleton(variant: ArticleCardVariant.row),
            ],
          ),
          DashboardStatus.error => ErrorRetryCard(
            message: "Couldn't load the news. Please try again.",
            onRetry: viewModel.retry,
          ),
          DashboardStatus.allUnavailable => notice(
            'News is temporarily unavailable. Please try again later.',
          ),
          DashboardStatus.sourceUnavailable => notice(
            '${viewModel.unavailableSourceName} is temporarily unavailable '
            'right now.',
          ),
          DashboardStatus.empty => notice(
            'No news right now — check back soon.',
          ),
          DashboardStatus.ready => _portada(viewModel.slots),
        },
      ],
    );
  }
}
