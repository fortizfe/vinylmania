import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import '../view_models/profile_view_model.dart';
import 'dark_mode_row.dart';
import 'discogs_connection_card.dart';
import 'profile_header.dart';
import 'profile_section.dart';

/// Phones / narrow windows: sections stacked, sign out at the bottom.
class ProfileCompactLayout extends StatelessWidget {
  const ProfileCompactLayout({super.key, required this.viewModel});

  final ProfileViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProfileHeader(viewModel: viewModel),
          const SizedBox(height: 24),
          ProfileSection(
            title: 'Preferences',
            child: DarkModeRow(onChanged: viewModel.setDarkMode),
          ),
          const SizedBox(height: 24),
          ProfileSection(
            title: 'Connected services',
            child: DiscogsConnectionCard(viewModel: viewModel),
          ),
          const SizedBox(height: 32),
          VmButton.secondary(onPressed: viewModel.signOut, label: 'Sign out'),
        ],
      ),
    );
  }
}
