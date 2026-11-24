import 'package:material_ui/material_ui.dart';

import '../../core/widgets/vm_button.dart';
import '../view_models/profile_view_model.dart';
import 'dark_mode_row.dart';
import 'discogs_connection_card.dart';
import 'profile_header.dart';
import 'profile_section.dart';

/// Tablets / desktop: the two sections side by side.
class ProfileExpandedLayout extends StatelessWidget {
  const ProfileExpandedLayout({super.key, required this.viewModel});

  final ProfileViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(32),
      child: Align(
        alignment: Alignment.topLeft,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1024),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ProfileHeader(viewModel: viewModel),
              const SizedBox(height: 32),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: ProfileSection(
                      title: 'Preferences',
                      child: DarkModeRow(onChanged: viewModel.setDarkMode),
                    ),
                  ),
                  const SizedBox(width: 32),
                  Expanded(
                    child: ProfileSection(
                      title: 'Connected services',
                      child: DiscogsConnectionCard(viewModel: viewModel),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              Align(
                alignment: Alignment.centerLeft,
                child: VmButton.secondary(
                  onPressed: viewModel.signOut,
                  label: 'Sign out',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
