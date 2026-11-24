import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/domain/models/wantlist/want_entry.dart';
import 'package:vinylmania/ui/wishlist/view_models/wishlist_view_model.dart';

import '../../../helpers/fakes/fake_wantlist_repository.dart';
import '../../../helpers/fixtures/wantlist_fixtures.dart';

void main() {
  late FakeWantlistRepository repository;
  late List<({int page, bool refresh})> calls;
  late WishlistViewModel viewModel;

  setUp(() {
    repository = FakeWantlistRepository();
    calls = [];
    repository.onList = (page, refresh) async {
      calls.add((page: page, refresh: refresh));
      return Paged(items: [wantEntry], page: page, hasMore: page < 2);
    };
    viewModel = WishlistViewModel(wantlistRepository: repository);
  });

  tearDown(() => viewModel.dispose());

  test('loads the first page', () async {
    expect(viewModel.isLoading, isTrue);
    await viewModel.load();

    expect(viewModel.isLoading, isFalse);
    expect(viewModel.page, 1);
    expect(viewModel.entries, [wantEntry]);
    expect(viewModel.hasPrevious, isFalse);
    expect(viewModel.hasNext, isTrue);
  });

  test('next and previous move one page and show skeletons', () async {
    await viewModel.load();

    final next = viewModel.nextPage();
    expect(viewModel.isLoading, isTrue);
    expect(viewModel.entries, isEmpty);
    await next;
    expect(viewModel.page, 2);
    expect(viewModel.hasNext, isFalse);
    expect(viewModel.hasPrevious, isTrue);

    await viewModel.previousPage();
    expect(viewModel.page, 1);
    expect(calls.map((c) => c.page), [1, 2, 1]);
  });

  test('refresh reloads the current page from Discogs', () async {
    await viewModel.load();
    await viewModel.nextPage();

    final refreshing = viewModel.refresh();
    expect(viewModel.isRefreshing, isTrue);
    await refreshing;

    expect(calls.last, (page: 2, refresh: true));
    expect(viewModel.isRefreshing, isFalse);
    expect(viewModel.refreshFailed, isFalse);
  });

  test('a failed refresh keeps the cards and flags the error', () async {
    await viewModel.load();
    repository.onList = (_, _) async =>
        throw const ApiException(503, 'unavailable', 'down');

    await viewModel.refresh();
    expect(viewModel.refreshFailed, isTrue);
    expect(viewModel.entries, [wantEntry]);
  });

  test('a refresh overtaken by a page change stops loading', () async {
    await viewModel.load();
    final slow = Completer<Paged<WantEntry>>();
    repository.onList = (page, refresh) => refresh
        ? slow.future
        : Future.value(
            Paged(items: [minimalWantEntry], page: page, hasMore: false),
          );

    final refreshing = viewModel.refresh();
    await viewModel.nextPage();
    slow.complete(Paged(items: [wantEntry], page: 1, hasMore: true));
    await refreshing;

    expect(viewModel.isRefreshing, isFalse);
    expect(viewModel.page, 2);
    expect(viewModel.entries, [minimalWantEntry]);
  });

  test('a refresh overtaken by a removal stops loading', () async {
    await viewModel.load();
    final slow = Completer<Paged<WantEntry>>();
    repository.onList = (page, refresh) => refresh
        ? slow.future
        : Future.value(
            Paged(items: [minimalWantEntry], page: page, hasMore: false),
          );

    final refreshing = viewModel.refresh();
    await viewModel.remove(249504);
    await pumpEventQueue();
    slow.complete(Paged(items: [wantEntry], page: 1, hasMore: true));
    await refreshing;

    expect(viewModel.isRefreshing, isFalse);
    expect(viewModel.entries, [minimalWantEntry]);
  });

  test('a refresh pending at dispose finishes quietly', () async {
    final vm = WishlistViewModel(wantlistRepository: repository);
    await vm.load();
    final slow = Completer<Paged<WantEntry>>();
    repository.onList = (_, _) => slow.future;

    final refreshing = vm.refresh();
    vm.dispose();
    slow.complete(Paged(items: [wantEntry], page: 1, hasMore: false));
    await refreshing;
  });

  test('remove deletes the release and reloads the page', () async {
    await viewModel.load();
    final removed = <int>[];
    repository.onRemove = (id) async => removed.add(id);

    expect(await viewModel.remove(249504), isTrue);
    await pumpEventQueue();

    expect(removed, [249504]);
    expect(calls.map((c) => c.page), [1, 1]);
    expect(viewModel.removeFailed, isFalse);
  });

  test('removing the last card of a later page steps back', () async {
    await viewModel.load();
    await viewModel.nextPage();
    repository.onList = (page, refresh) async {
      calls.add((page: page, refresh: refresh));
      return Paged<WantEntry>(
        items: page == 2 ? const [] : [wantEntry],
        page: page,
        hasMore: false,
      );
    };

    await viewModel.remove(249504);
    await pumpEventQueue();

    expect(viewModel.page, 1);
    expect(viewModel.entries, [wantEntry]);
  });

  test('a failed remove flags the error and keeps the card', () async {
    await viewModel.load();
    repository.onRemove = (_) async =>
        throw const ApiException(503, 'unavailable', 'down');

    expect(await viewModel.remove(249504), isFalse);
    expect(viewModel.removeFailed, isTrue);
    expect(viewModel.entries, [wantEntry]);
  });

  test('empty wishlist', () async {
    repository.onList = (page, _) async =>
        Paged<WantEntry>(items: const [], page: page, hasMore: false);
    await viewModel.load();

    expect(viewModel.entries, isEmpty);
    expect(viewModel.isLoading, isFalse);
    expect(viewModel.loadError, isNull);
  });

  for (final (code, relink) in [
    ('discogs_not_linked', false),
    ('discogs_link_invalid', true),
  ]) {
    test('$code shows the gate', () async {
      repository.onList = (_, _) async => throw ApiException(409, code, 'x');
      await viewModel.load();

      expect(viewModel.isGated, isTrue);
      expect(viewModel.needsRelink, relink);
    });
  }

  test('another load failure is retryable', () async {
    repository.onList = (_, _) async =>
        throw const ApiException(0, 'network_error', 'offline');
    await viewModel.load();
    expect(viewModel.loadError, isNotNull);
    expect(viewModel.isGated, isFalse);

    repository.onList = (page, _) async =>
        Paged(items: [wantEntry], page: page, hasMore: false);
    await viewModel.load();
    expect(viewModel.loadError, isNull);
    expect(viewModel.entries, [wantEntry]);
  });
}
