import 'package:material_ui/material_ui.dart';

import '../../core/widgets/dismissible_banner.dart';
import '../../core/widgets/page_title.dart';
import '../view_models/profile_view_model.dart';
import '../../core/widgets/banner_tone.dart';

/// Title, intro and the link-outcome / theme-save banners.
class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.viewModel});

  final ProfileViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final vm = viewModel;
    final linkMessage = vm.linkMessage;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const PageTitle('Profile'),
        const SizedBox(height: 4),
        Text(
          'Manage your account and connected services.',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        if (linkMessage != null) ...[
          const SizedBox(height: 16),
          DismissibleBanner(
            text: linkMessage,
            tone: vm.linkSucceeded ? BannerTone.success : BannerTone.warning,
            onDismiss: vm.dismissLinkMessage,
          ),
        ],
        if (vm.themeSaveFailed) ...[
          const SizedBox(height: 16),
          DismissibleBanner(
            text:
                "Your dark mode preference may not have been saved. It's "
                'applied now, but might not persist across devices or '
                'sessions.',
            tone: BannerTone.warning,
            onDismiss: vm.dismissThemeSaveFailure,
          ),
        ],
      ],
    );
  }
}
