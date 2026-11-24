import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/catalog/master_release_version.dart';
import 'package:vinylmania/domain/models/paged.dart';
import 'package:vinylmania/ui/release_detail/view_models/detail_status.dart';
import 'package:vinylmania/ui/release_detail/view_models/master_detail_view_model.dart';

import '../../../helpers/fakes/fake_catalog_repository.dart';
import '../../../helpers/fakes/fake_streaming_repository.dart';
import '../../../helpers/fixtures/catalog_fixtures.dart';

void main() {
  late FakeCatalogRepository catalog;
  late FakeStreamingRepository streaming;

  setUp(() {
    catalog = FakeCatalogRepository();
    streaming = FakeStreamingRepository();
  });

  MasterDetailViewModel build({int id = 6513}) => MasterDetailViewModel(
    masterId: id,
    catalogRepository: catalog,
    streamingRepository: streaming,
  );

  test('loads the master, page 1 of versions and streaming links', () async {
    final calls = <List<Object>>[];
    streaming.onLinks = (barcodes, artist, title, _) async {
      calls.add([barcodes, artist, title]);
      return [];
    };
    final vm = build();
    await vm.load();
    await Future<void>.delayed(Duration.zero);

    expect(vm.status, DetailStatus.ready);
    expect(vm.master, same(master));
    expect(vm.versionsStatus, DetailStatus.ready);
    expect(vm.versions!.page, 1);
    expect(vm.versions!.items, hasLength(2));
    expect(calls, [
      [<String>[], 'Metallica', 'Master Of Puppets'],
    ]);
  });

  test('id 0 → notFound; errors map like the release', () async {
    final zero = build(id: 0);
    await zero.load();
    expect(zero.status, DetailStatus.notFound);

    catalog.onGetMaster = (_) async =>
        throw const ApiException(401, 'discogs_link_invalid', 'x');
    final relink = build();
    await relink.load();
    expect(relink.status, DetailStatus.relink);

    catalog.onGetMaster = (_) async => throw const ApiException(404, 'x', 'x');
    final missing = build();
    await missing.load();
    expect(missing.status, DetailStatus.notFound);
  });

  test('versions paging: previous/next fetch that page', () async {
    final pages = <int>[];
    catalog.onGetMasterVersions = (_, page) async {
      pages.add(page);
      return Paged(items: [masterVersion], page: page, hasMore: page < 2);
    };
    final vm = build();
    await vm.load();
    expect(vm.versions!.hasMore, isTrue);

    final done = Completer<Paged<MasterReleaseVersion>>();
    catalog.onGetMasterVersions = (_, page) {
      pages.add(page);
      return done.future;
    };
    final next = vm.goToVersionsPage(2);
    expect(vm.versionsStatus, DetailStatus.loading);
    done.complete(Paged(items: [masterVersion], page: 2, hasMore: false));
    await next;

    expect(pages, [1, 2]);
    expect(vm.versionsPage, 2);
    expect(vm.versions!.hasMore, isFalse);
  });

  test('versions errors: relink vs generic', () async {
    catalog.onGetMasterVersions = (_, _) async =>
        throw const ApiException(401, 'discogs_link_invalid', 'x');
    final vm = build();
    await vm.load();
    expect(vm.status, DetailStatus.ready);
    expect(vm.versionsStatus, DetailStatus.relink);

    catalog.onGetMasterVersions = (_, _) async =>
        throw const ApiException(500, 'x', 'x');
    await vm.goToVersionsPage(1);
    expect(vm.versionsStatus, DetailStatus.error);
  });
}
