import 'package:flutter_test/flutter_test.dart';

import 'package:rico_app/main.dart';

void main() {
  testWidgets('RicoApp shows the chat screen greeting', (WidgetTester tester) async {
    await tester.pumpWidget(const RicoApp());

    expect(find.textContaining('ريكو'), findsWidgets);
  });
}
