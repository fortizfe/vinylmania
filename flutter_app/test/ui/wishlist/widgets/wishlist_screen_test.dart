import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/domain/models/wantlist/want_entry.dart';
import 'package:vinylmania/ui/core/widgets/discogs_link_gate.dart';
import 'package:vinylmania/ui/library/widgets/record_card_skeleton.dart';
import 'package:vinylmania/ui/wishlist/view_models/wishlist_view_model.dart';
import 'package:vinylmania/ui/wishlist/widgets/wishlist_card.dart';
import 'package:vinylmania/ui/wishlist/widgets/wishlist_screen.dart';

import '../../../helpers/fakes/fake_wantlist_repository.dart';
import '../../../helpers/fixtures/wantlist_fixtures.dart';
import '../../../helpers/pump_screen.dart';

void main() {
  late FakeWantlistRepository repository;
  late List<int> pages;

  setUp(() {
    repository = FakeWantlistRepository();
    pages = [];
    repository.onList = (page, _) async {
      pages.add(page);
      return Paged(
        items: [wantEntry, minimalWantEntry],
        page: page,
        hasMore: page == 1,
      );
    };
  });

  Future<void> pump(
    WidgetTester tester, {
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
  }) async {
    await pumpScreen(
      tester,
      WishlistScreen(
        createViewModel: () =>
            WishlistViewModel(wantlistRepository: repository),
      ),
      size: size,
      mode: mode,
      textScale: textScale,
    );
    await tester.pump();
  }

  for (final (name, size) in [
    ('compact', compactSize),
    ('expanded', expandedSize),
  ]) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('populated $name $mode meets the a11y guidelines', (
        tester,
      ) async {
        await pump(tester, size: size, mode: mode);

        expect(find.text('Your wishlist'), findsOneWidget);
        expect(find.byType(WishlistCard), findsNWidgets(2));
        expect(find.text('Master Of Puppets'), findsOneWidget);
        expect(find.text('Open release'), findsOneWidget);
        await expectA11yGuidelines(tester);
      });
    }

    testWidgets('skeletons while loading ($name)', (tester) async {
      final pending = Completer<Paged<WantEntry>>();
      repository.onList = (_, _) => pending.future;
      await pump(tester, size: size);

      expect(find.byType(RecordCardSkeleton), findsWidgets);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      final skeleton = tester.getRect(find.byType(RecordCardSkeleton).first);
      pending.complete(Paged(items: [wantEntry], page: 1, hasMore: false));
      await tester.pump();
      expect(find.byType(RecordCardSkeleton), findsNothing);
      expect(
        tester.getRect(find.byType(WishlistCard).first),
        skeleton,
        reason: 'no layout shift between skeleton and loaded',
      );
    });
  }

  testWidgets('Previous / Next page through the wishlist', (tester) async {
    await pump(tester, size: expandedSize);

    await tester.tap(find.text('Previous'));
    await tester.pump();
    expect(pages, [1], reason: 'Previous is disabled on page 1');

    await tester.tap(find.text('Next'));
    await tester.pump();
    await tester.pump();
    expect(pages, [1, 2]);

    await tester.tap(find.text('Next'));
    await tester.pump();
    expect(pages, [1, 2], reason: 'Next is disabled on the last page');
  });

  testWidgets('a card opens the release detail', (tester) async {
    await pump(tester);

    await tester.tap(find.text('Master Of Puppets'));
    await tester.pumpAndSettle();

    expect(find.text('route: /releases/249504'), findsOneWidget);
  });

  testWidgets('remove asks for confirmation, then removes', (tester) async {
    final removed = <int>[];
    repository.onRemove = (id) async => removed.add(id);
    await pump(tester, size: expandedSize);

    await tester.tap(find.bySemanticsLabel('Remove from wishlist').first);
    await tester.pumpAndSettle();
    expect(find.text('Remove from wishlist?'), findsOneWidget);
    expect(
      find.text(
        'Remove “Master Of Puppets” from your wishlist? This removes it '
        'from your Discogs wantlist too.',
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(removed, isEmpty);

    await tester.tap(find.bySemanticsLabel('Remove from wishlist').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    expect(removed, [249504]);
    expect(pages, [1, 1], reason: 'the page reloads after the removal');
  });

  testWidgets('an unavailable record stays removable, named generically', (
    tester,
  ) async {
    await pump(tester, size: expandedSize);

    await tester.tap(find.bySemanticsLabel('Remove from wishlist').last);
    await tester.pumpAndSettle();
    expect(find.textContaining('“this record”'), findsOneWidget);
  });

  testWidgets('a failed removal shows the web message', (tester) async {
    repository.onRemove = (_) async =>
        throw const ApiException(503, 'unavailable', 'down');
    await pump(tester, size: expandedSize);

    await tester.tap(find.bySemanticsLabel('Remove from wishlist').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();

    expect(
      find.text("Couldn't remove it right now. Please try again."),
      findsOneWidget,
    );
    expect(find.byType(WishlistCard), findsNWidgets(2));
  });

  testWidgets('empty wishlist', (tester) async {
    repository.onList = (page, _) async =>
        Paged<WantEntry>(items: const [], page: page, hasMore: false);
    await pump(tester);

    expect(
      find.text(
        'Nothing on your wishlist yet. Add a release from search or its '
        'detail page.',
      ),
      findsOneWidget,
    );
    expect(find.text('Next'), findsNothing);
  });

  testWidgets('a load error offers a working Retry', (tester) async {
    repository.onList = (_, _) async =>
        throw const ApiException(0, 'network_error', 'offline');
    await pump(tester);

    expect(
      find.text(
        'Something went wrong while loading your wishlist. Please try again.',
      ),
      findsOneWidget,
    );
    repository.onList = (page, _) async =>
        Paged(items: [wantEntry], page: page, hasMore: false);
    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump();
    expect(find.byType(WishlistCard), findsOneWidget);
  });

  testWidgets('refresh failure shows the web message', (tester) async {
    await pump(tester);
    repository.onList = (_, _) async =>
        throw const ApiException(429, 'rate_limited', 'slow');

    await tester.tap(find.text('Refresh'));
    await tester.pump();
    await tester.pump();

    expect(
      find.text("Couldn't refresh from Discogs right now. Please try again."),
      findsOneWidget,
    );
  });

  testWidgets('the gate replaces the whole wishlist', (tester) async {
    repository.onList = (_, _) async =>
        throw const ApiException(409, 'discogs_not_linked', 'link');
    await pump(tester);

    final gate = tester.widget<DiscogsLinkGate>(find.byType(DiscogsLinkGate));
    expect(gate.relink, isFalse);
    expect(gate.context, 'wishlist');
    expect(find.text('Refresh'), findsNothing);
  });

  testWidgets('200 % text scale does not overflow', (tester) async {
    await pump(tester, textScale: 2);

    expect(tester.takeException(), isNull);
  });
}
