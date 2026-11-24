import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import 'app/app.dart';
import 'app/dependencies.dart';
import 'config/api_config.dart';

void main() {
  ensureApiBaseUrlConfigured();
  runApp(MultiProvider(providers: buildProviders(), child: const App()));
}
