import 'package:material_ui/material_ui.dart';

import '../view_models/sign_in_view_model.dart';
import 'sign_in_action.dart';
import 'sign_in_hero.dart';
import 'sign_in_pillar.dart';

/// Phones / narrow windows: one column, the button in the thumb zone.
class SignInCompactLayout extends StatelessWidget {
  const SignInCompactLayout({super.key, required this.viewModel});

  final SignInViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SignInHero(),
          const SizedBox(height: 32),
          for (final p in signInPillars) ...[
            SignInPillar(
              icon: p.icon,
              title: p.title,
              description: p.description,
            ),
            const SizedBox(height: 20),
          ],
          const SizedBox(height: 12),
          SignInAction(viewModel: viewModel),
        ],
      ),
    );
  }
}
