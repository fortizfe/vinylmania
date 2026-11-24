import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/models/streaming/streaming_link.dart';
import 'package:vinylmania/ui/core/open_external_link.dart';
import 'package:vinylmania/ui/core/widgets/skeleton.dart';
import 'package:vinylmania/ui/core/widgets/vm_card.dart';
import 'package:vinylmania/ui/release_detail/view_models/streaming_links_loader.dart';
import 'package:vinylmania/ui/release_detail/widgets/streaming_links_section.dart';

import '../../../helpers/fakes/fake_streaming_repository.dart';
import '../../../helpers/pump_screen.dart';

void main() {
  late FakeStreamingRepository repository;
  late StreamingLinksLoader loader;

  setUp(() {
    repository = FakeStreamingRepository();
    loader = StreamingLinksLoader(repository);
  });

  testWidgets('skeleton while loading, then the link opens externally', (
    tester,
  ) async {
    final done = Completer<List<StreamingLink>>();
    repository.onLinks = (_, _, _, _) => done.future;
    final opened = <Uri>[];
    final original = launchExternalUrl;
    launchExternalUrl = (uri) async {
      opened.add(uri);
      return true;
    };
    addTearDown(() => launchExternalUrl = original);

    await pumpScreen(
      tester,
      Align(
        alignment: Alignment.topCenter,
        child: StreamingLinksSection(loader: loader),
      ),
    );
    expect(find.byType(Skeleton), findsNothing, reason: 'nothing to load yet');

    unawaited(loader.load(artist: 'Metallica', title: 'Master Of Puppets'));
    await tester.pump();
    expect(find.byType(Skeleton), findsNWidgets(2));
    final loadingHeight = tester.getSize(find.byType(VmCard));

    done.complete([
      const StreamingLink(
        platform: 'apple_music',
        url: 'https://music.apple.com/album/1',
      ),
    ]);
    await tester.pump();
    expect(find.text('Escúchalo en streaming'), findsOneWidget);
    expect(
      tester.getSize(find.byType(VmCard)).height,
      loadingHeight.height,
      reason: 'no layout shift between skeleton and links',
    );
    await tester.tap(find.bySemanticsLabel('Escuchar en Apple Music'));
    expect(opened, [Uri.parse('https://music.apple.com/album/1')]);
    await expectA11yGuidelines(tester);
  });

  testWidgets('hidden when empty or only unknown platforms', (tester) async {
    repository.onLinks = (_, _, _, _) async => [
      const StreamingLink(platform: 'tidal', url: 'https://tidal.com/1'),
    ];
    await pumpScreen(
      tester,
      Align(
        alignment: Alignment.topCenter,
        child: StreamingLinksSection(loader: loader),
      ),
    );
    await loader.load(artist: 'Metallica', title: 'Master Of Puppets');
    await tester.pump();
    expect(find.text('Escúchalo en streaming'), findsNothing);
    expect(find.byType(VmCard), findsNothing);
  });
}
