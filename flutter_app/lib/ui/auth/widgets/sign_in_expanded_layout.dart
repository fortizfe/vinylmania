import 'package:material_ui/material_ui.dart';

import '../view_models/sign_in_view_model.dart';
import 'sign_in_action.dart';
import 'sign_in_hero.dart';
import 'sign_in_pillar.dart';

/// Tablets / desktop: hero + button on the left, pillars on the right.
class SignInExpandedLayout extends StatelessWidget {
  const SignInExpandedLayout({super.key, required this.viewModel});

  final SignInViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(48),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1024),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SignInHero(wordmarkSize: 72),
                    const SizedBox(height: 32),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 360),
                      child: SignInAction(viewModel: viewModel),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 64),
              Expanded(
                child: Column(
                  children: [
                    for (final p in signInPillars) ...[
                      SignInPillar(
                        icon: p.icon,
                        title: p.title,
                        description: p.description,
                      ),
                      const SizedBox(height: 32),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
