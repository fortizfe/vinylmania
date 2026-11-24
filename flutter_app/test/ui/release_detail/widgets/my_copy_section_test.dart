import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:vinylmania/domain/api_exception.dart';
import 'package:vinylmania/domain/models/library/library_entry.dart';
import 'package:vinylmania/ui/release_detail/view_models/record_detail_view_model.dart';
import 'package:vinylmania/ui/release_detail/widgets/my_copy_section.dart';

import '../../../helpers/fakes/fake_library_repository.dart';
import '../../../helpers/fakes/fake_streaming_repository.dart';
import '../../../helpers/fixtures/library_fixtures.dart';
import '../../../helpers/pump_screen.dart';

void main() {
  late FakeLibraryRepository library;
  late List<Map<String, Object>> patches;

  setUp(() {
    library = FakeLibraryRepository();
    patches = [];
    library.onUpdateCopy = (_, patch) async {
      patches.add(patch);
      return libraryEntry;
    };
  });

  Future<RecordDetailViewModel> pump(
    WidgetTester tester, {
    Map<String, bool>? editable,
    double textScale = 1,
  }) async {
    if (editable != null) {
      library.onGet = (_) async => LibraryEntry.fromJson({
        ...libraryEntryJson,
        'discogs': {...copyDataJson, 'editable': editable},
      });
    }
    final vm = RecordDetailViewModel(
      entryId: 'entry-1',
      libraryRepository: library,
      streamingRepository: FakeStreamingRepository(),
    );
    await vm.load();
    await pumpScreen(
      tester,
      SingleChildScrollView(child: MyCopySection(viewModel: vm)),
      textScale: textScale,
    );
    return vm;
  }

  testWidgets('shows the copy; non-editable notes are read-only', (
    tester,
  ) async {
    await pump(tester);
    expect(find.text('Your copy'), findsOneWidget);
    expect(find.text('Near Mint (NM or M-)'), findsOneWidget);
    expect(find.text('Very Good Plus (VG+)'), findsOneWidget);
    expect(
      find.text('The “Notes” field is not available on this collection.'),
      findsOneWidget,
    );
    final notes = tester.widget<TextField>(find.byType(TextField));
    expect(notes.enabled, isFalse);
    expect(notes.controller!.text, 'Original pressing');
    await expectA11yGuidelines(tester);
  });

  testWidgets('picking a condition autosaves that one field', (tester) async {
    await pump(tester);
    await tester.tap(find.text('Near Mint (NM or M-)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mint (M)').last);
    await tester.pumpAndSettle();
    expect(patches, [
      {'mediaCondition': 'Mint (M)'},
    ]);
    expect(find.text('Saved'), findsOneWidget);
  });

  testWidgets('notes save on submit; failures say so', (tester) async {
    await pump(
      tester,
      editable: {
        'mediaCondition': true,
        'sleeveCondition': true,
        'notes': true,
      },
    );
    final editableEntry = await library.onGet('entry-1');
    library.onUpdateCopy = (_, patch) async {
      patches.add(patch);
      return editableEntry;
    };
    await tester.enterText(find.byType(TextField), 'Signed copy');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(patches, [
      {'notes': 'Signed copy'},
    ]);
    expect(find.text('Saved'), findsOneWidget);

    library.onUpdateCopy = (_, _) async =>
        throw const ApiException(500, 'x', 'x');
    await tester.enterText(find.byType(TextField), 'Another note');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(
      find.text("Couldn't save — check your connection and try again."),
      findsOneWidget,
    );
  });

  testWidgets('200 % text without overflow', (tester) async {
    await pump(tester, textScale: 2);
    expect(tester.takeException(), isNull);
  });
}
