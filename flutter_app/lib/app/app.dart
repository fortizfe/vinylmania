import 'package:material_ui/material_ui.dart';

/// Composition root of the native app: theme, routing and dependencies are
/// wired here as features arrive (see the flutter-architecture skill).
class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Vinylmania',
      home: Scaffold(body: Center(child: Text('Vinylmania'))),
    );
  }
}
