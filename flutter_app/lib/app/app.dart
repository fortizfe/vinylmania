import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../data/repositories/auth_repository.dart';
import '../ui/core/theme/app_theme.dart';
import 'router.dart';
import '../domain/models/auth/theme_preference.dart';

/// Composition root: themes, router and the session restore on start.
/// Expects the providers from `buildProviders()` above it.
class App extends StatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  late final AuthRepository _auth = context.read<AuthRepository>();
  late final GoRouter _router = buildRouter(_auth);

  @override
  void initState() {
    super.initState();
    _auth.restore();
  }

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _auth,
      builder: (_, _) => MaterialApp.router(
        title: 'Vinylmania',
        debugShowCheckedModeBanner: false,
        theme: buildLightTheme(),
        darkTheme: buildDarkTheme(),
        themeMode: switch (_auth.themePreference) {
          null => ThemeMode.system,
          ThemePreference.light => ThemeMode.light,
          ThemePreference.dark => ThemeMode.dark,
        },
        routerConfig: _router,
      ),
    );
  }
}
