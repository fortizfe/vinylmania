import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/feeds/feeds_dashboard.dart';
import 'package:vinylmania/domain/models/feeds/source_feed.dart';
import 'package:vinylmania/ui/core/open_external_link.dart';
import 'package:vinylmania/ui/core/widgets/skeleton.dart';
import 'package:vinylmania/ui/dashboard/view_models/dashboard_view_model.dart';
import 'package:vinylmania/ui/dashboard/widgets/article_card.dart';
import 'package:vinylmania/ui/dashboard/widgets/article_card_variant.dart';
import 'package:vinylmania/ui/dashboard/widgets/article_card_skeleton.dart';
import 'package:vinylmania/ui/dashboard/widgets/dashboard_compact_layout.dart';
import 'package:vinylmania/ui/dashboard/widgets/dashboard_expanded_layout.dart';
import 'package:vinylmania/ui/dashboard/widgets/dashboard_screen.dart';
import 'package:vinylmania/ui/dashboard/widgets/source_chip.dart';

import '../../../helpers/fakes/fake_feeds_repository.dart';
import '../../../helpers/fixtures/feeds_fixtures.dart';
import '../../../helpers/pump_screen.dart';

Map<String, Object?> _status(String id, String name, String status, bool p) => {
  'sourceId': id,
  'sourceName': name,
  'status': status,
  'priority': p,
};

ArticleCardVariant _variantOf(WidgetTester tester, String title) => tester
    .widget<ArticleCard>(
      find.ancestor(of: find.text(title), matching: find.byType(ArticleCard)),
    )
    .variant;

void main() {
  late FakeFeedsRepository repository;

  setUp(() => repository = FakeFeedsRepository());

  Future<void> pump(
    WidgetTester tester, {
    Size size = compactSize,
    ThemeMode mode = ThemeMode.light,
    double textScale = 1,
  }) async {
    await pumpScreen(
      tester,
      DashboardScreen(
        createViewModel: () => DashboardViewModel(feedsRepository: repository),
      ),
      size: size,
      mode: mode,
      textScale: textScale,
    );
    await tester.pump();
  }

  Finder chip(String text) =>
      find.ancestor(of: find.text(text), matching: find.byType(SourceChip));

  for (final (size, layout) in [
    (compactSize, DashboardCompactLayout),
    (expandedSize, DashboardExpandedLayout),
  ]) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('$layout shows the front page and chips ($mode)', (
        tester,
      ) async {
        await pump(tester, size: size, mode: mode);

        expect(find.byType(layout), findsOneWidget);
        expect(find.text('News'), findsWidgets);
        // a1 has an image → lead; a2 has none → "Latest" row.
        expect(
          _variantOf(tester, 'Metallica announce reissue'),
          ArticleCardVariant.lead,
        );
        expect(_variantOf(tester, 'Short news'), ArticleCardVariant.row);
        expect(find.text('Latest'), findsOneWidget);
        expect(find.byType(ArticleCard), findsNWidgets(2));
        expect(find.text('Metallica announce reissue'), findsOneWidget);
        expect(find.text('All sources'), findsOneWidget);
        expect(find.text('Metal Hammer'), findsOneWidget);
        // Unavailable is said in words, not colour alone.
        expect(find.text('unavailable'), findsOneWidget);
        await expectA11yGuidelines(tester);
      });
    }

    testWidgets('$layout shows card-shaped skeletons while loading', (
      tester,
    ) async {
      repository.onDashboard = () => Completer<FeedsDashboard>().future;
      await pump(tester, size: size);

      expect(find.byType(layout), findsOneWidget);
      expect(find.byType(ArticleCardSkeleton), findsWidgets);
      expect(find.byType(Skeleton), findsWidgets);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.byType(ArticleCard), findsNothing);
      await expectA11yGuidelines(tester);
    });

    testWidgets('$layout has no overflow at text scale 2.0', (tester) async {
      await pump(tester, size: size, textScale: 2);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('the lead shows its excerpt from 640 px up, as the web', (
    tester,
  ) async {
    const excerpt = 'The band revisits its 1986 classic.';
    await pump(tester, size: expandedSize);
    expect(find.text(excerpt), findsOneWidget);

    await pump(tester, size: compactSize);
    expect(find.text(excerpt), findsNothing);
  });

  testWidgets('expanded puts the lead beside the tiles', (tester) async {
    repository.onSource = (_) async => SourceFeed.fromJson({
      ...sourceFeedJson,
      'articles': [
        for (final (id, source) in [('l', 'a'), ('t1', 'b'), ('t2', 'c')])
          {...articleJson, 'id': id, 'title': 'Title $id', 'sourceId': source},
      ],
    });
    await pump(tester, size: expandedSize);
    await tester.tap(chip('Metal Hammer'));
    await tester.pump();
    await tester.pump();

    expect(_variantOf(tester, 'Title l'), ArticleCardVariant.lead);
    expect(_variantOf(tester, 'Title t1'), ArticleCardVariant.tile);
    final lead = tester.getRect(find.text('Title l'));
    final tile = tester.getRect(find.text('Title t1'));
    expect(tile.left, greaterThan(lead.right));
  });

  testWidgets('priority sources come first', (tester) async {
    repository.onDashboard = () async => FeedsDashboard.fromJson({
      ...dashboardJson,
      'sourceStatuses': [
        _status('kerrang', 'Kerrang', 'ok', false),
        _status('metal-hammer', 'Metal Hammer', 'ok', true),
      ],
    });
    await pump(tester);

    expect(
      tester.getTopLeft(chip('Metal Hammer')).dx,
      lessThan(tester.getTopLeft(chip('Kerrang')).dx),
    );
  });

  testWidgets('chips expose their state to assistive tech', (tester) async {
    await pump(tester);

    expect(
      tester.getSemantics(chip('All sources')),
      isSemantics(label: 'All sources', isSelected: true, isButton: true),
    );
    expect(
      tester.getSemantics(chip('Rolling Stone')),
      isSemantics(label: 'Rolling Stone unavailable', isSelected: false),
    );
  });

  testWidgets('a source chip shows that source only', (tester) async {
    final requested = <String>[];
    repository.onSource = (id) async {
      requested.add(id);
      return sourceFeed;
    };
    await pump(tester);

    await tester.tap(chip('Metal Hammer'));
    await tester.pump();
    await tester.pump();

    expect(requested, ['metal-hammer']);
    expect(find.text('Metallica announce reissue'), findsOneWidget);
    expect(find.text('Short news'), findsNothing);
    expect(
      tester.getSemantics(chip('Metal Hammer')),
      isSemantics(isSelected: true),
    );
  });

  testWidgets('an unavailable source says so by name', (tester) async {
    repository.onSource = (_) async => minimalSourceFeed;
    await pump(tester);

    await tester.ensureVisible(chip('Rolling Stone'));
    await tester.tap(chip('Rolling Stone'));
    await tester.pump();
    await tester.pump();

    expect(
      find.text('Rolling Stone is temporarily unavailable right now.'),
      findsOneWidget,
    );
  });

  testWidgets('every source down: one notice, no chips', (tester) async {
    repository.onDashboard = () async => FeedsDashboard.fromJson({
      ...dashboardJson,
      'sourceStatuses': [
        _status('metal-hammer', 'Metal Hammer', 'unavailable', true),
      ],
    });
    await pump(tester);

    expect(
      find.text('News is temporarily unavailable. Please try again later.'),
      findsOneWidget,
    );
    expect(find.text('All sources'), findsNothing);
  });

  testWidgets('empty dashboard', (tester) async {
    repository.onDashboard = () async => minimalFeedsDashboard;
    await pump(tester);

    expect(find.text('No news right now — check back soon.'), findsOneWidget);
  });

  testWidgets('error shows a real retry', (tester) async {
    repository.onDashboard = () async =>
        throw const ApiException(0, 'network_error', 'offline');
    await pump(tester);

    expect(find.text("Couldn't load the news. Please try again."), findsOne);
    await expectA11yGuidelines(tester);

    repository.onDashboard = () async => feedsDashboard;
    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump();

    expect(find.byType(ArticleCard), findsNWidgets(2));
  });

  testWidgets('tapping an article opens it in the browser', (tester) async {
    final opened = <Uri>[];
    final original = launchExternalUrl;
    launchExternalUrl = (uri) async {
      opened.add(uri);
      return true;
    };
    addTearDown(() => launchExternalUrl = original);
    await pump(tester);

    await tester.tap(find.text('Metallica announce reissue'));

    expect(opened, [Uri.parse('https://news.example/metallica')]);
    expect(
      tester.getSemantics(find.byType(ArticleCard).first),
      isSemantics(
        label: 'Metallica announce reissue, Metal Hammer, June 2, 2024',
        isButton: true,
      ),
    );
  });
}
