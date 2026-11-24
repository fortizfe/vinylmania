import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/widgets/error_retry_card.dart';
import '../../core/widgets/skeleton.dart';
import '../../core/widgets/vm_button.dart';
import '../../core/widgets/vm_card.dart';
import '../view_models/detail_status.dart';
import '../view_models/master_detail_view_model.dart';
import 'master_version_row.dart';
import 'master_version_tile.dart';
import 'relink_notice.dart';
import 'section_heading.dart';

/// Web `MasterVersionsTable`: cards when compact, a table when expanded,
/// Previous / Next paging. Tap → release detail.
class MasterVersionsList extends StatelessWidget {
  const MasterVersionsList({super.key, required this.viewModel});

  final MasterDetailViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    final expanded = MediaQuery.sizeOf(context).width >= 840;
    final versions = vm.versions;
    final Widget body = switch (vm.versionsStatus) {
      DetailStatus.relink => const RelinkNotice(),
      DetailStatus.error || DetailStatus.notFound => ErrorRetryCard(
        message: "Couldn't load this master's versions. Please try again.",
        onRetry: () => vm.goToVersionsPage(vm.versionsPage),
      ),
      DetailStatus.loading => Column(
        spacing: 8,
        children: [
          for (var i = 0; i < (expanded ? 10 : 5); i++)
            Skeleton(height: expanded ? 40 : 64),
        ],
      ),
      DetailStatus.ready => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: expanded ? 0 : 8,
        children: [
          if (expanded) const MasterVersionRow(),
          for (final v in versions!.items)
            expanded
                ? MasterVersionRow(
                    version: v,
                    onTap: () => context.push('/releases/${v.discogsId}'),
                  )
                : MasterVersionTile(
                    version: v,
                    onTap: () => context.push('/releases/${v.discogsId}'),
                  ),
        ],
      ),
    };
    final page = vm.versionsPage;
    final showPager = page > 1 || (versions?.hasMore ?? false);
    final idle = vm.versionsStatus != DetailStatus.loading;
    return VmCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          const SectionHeading('Versions'),
          body,
          if (showPager)
            Wrap(
              spacing: 12,
              children: [
                VmButton.secondary(
                  onPressed: idle && page > 1
                      ? () => vm.goToVersionsPage(page - 1)
                      : null,
                  label: 'Previous',
                ),
                VmButton.secondary(
                  onPressed: idle && (versions?.hasMore ?? false)
                      ? () => vm.goToVersionsPage(page + 1)
                      : null,
                  label: 'Next',
                ),
              ],
            ),
        ],
      ),
    );
  }
}
