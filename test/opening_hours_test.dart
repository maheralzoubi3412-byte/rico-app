import 'package:flutter_test/flutter_test.dart';
import 'package:rico_app/utils/opening_hours.dart';

DateTime _at(int weekday, int hour, int minute) {
  // 2024-01-01 كان يوم اثنين (weekday=1)؛ نبني تاريخاً بنفس يوم الأسبوع المطلوب
  final monday = DateTime(2024, 1, 1);
  return monday.add(Duration(days: weekday - 1, hours: hour, minutes: minute));
}

void main() {
  group('OpeningHours.isOpenNow', () {
    test('24/7 يعني مفتوح دائماً', () {
      expect(OpeningHours.isOpenNow('24/7', _at(3, 3, 0)), isTrue);
    });

    test('نص فارغ أو null يرجع null', () {
      expect(OpeningHours.isOpenNow(null, _at(1, 10, 0)), isNull);
      expect(OpeningHours.isOpenNow('', _at(1, 10, 0)), isNull);
    });

    test('نطاق يومي بسيط داخل الدوام', () {
      expect(OpeningHours.isOpenNow('Mo-Fr 08:00-22:00', _at(2, 10, 0)), isTrue);
    });

    test('نطاق يومي بسيط خارج الدوام', () {
      expect(OpeningHours.isOpenNow('Mo-Fr 08:00-22:00', _at(2, 23, 0)), isFalse);
    });

    test('يوم خارج قائمة الأيام يرجع null (لا توجد قاعدة له)', () {
      expect(OpeningHours.isOpenNow('Mo-Fr 08:00-22:00', _at(6, 10, 0)), isNull);
    });

    test('يوم مغلق صراحة', () {
      expect(OpeningHours.isOpenNow('Mo-Sa 09:00-20:00; Su off', _at(7, 12, 0)), isFalse);
    });

    test('نطاق يعبر منتصف الليل', () {
      expect(OpeningHours.isOpenNow('Mo-Su 22:00-02:00', _at(3, 23, 0)), isTrue);
      expect(OpeningHours.isOpenNow('Mo-Su 22:00-02:00', _at(3, 1, 0)), isTrue);
      expect(OpeningHours.isOpenNow('Mo-Su 22:00-02:00', _at(3, 10, 0)), isFalse);
    });

    test('صياغة تحتوي عطلة رسمية PH ترجع null (غير مدعومة)', () {
      expect(OpeningHours.isOpenNow('Mo-Fr 08:00-22:00; PH off', _at(2, 10, 0)), isNull);
    });

    test('وقت بلا يوم يعني كل الأيام', () {
      expect(OpeningHours.isOpenNow('08:00-17:00', _at(7, 9, 0)), isTrue);
    });
  });
}
