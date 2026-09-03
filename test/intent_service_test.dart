import 'package:flutter_test/flutter_test.dart';
import 'package:rico_app/services/intent_service.dart';

/// يحاكي القرار الفعلي في chat_screen عند فشل مصنّف الـLLM: إشارة بحث؟ ولا
/// دردشة؟ ولا تخمين افتراضي؟
String route(String text, {String? last}) {
  if (IntentService.hasPlaceOrDealsSignal(text, lastCategorySlug: last)) return 'search';
  return IntentService.detectOffTopicReply(text) != null ? 'chat' : 'fallback';
}

void main() {
  group('مطابقة الفئات على حدود الكلمة', () {
    // "كتب" داخل "اكتب"/"مكتب"، و"عرض" داخل "معرض"، و"مول" داخل "محمول" —
    // كانت كلها تطلّع فئة غلط قبل مطابقة حدود الكلمة.
    test('لا تطابق كلمة داخل كلمة أطول', () {
      expect(IntentService.parseMulti('بدي مكتب عقارات').first.slug, 'real_estate');
      expect(IntentService.parseMulti('أبي مكتب سفريات').first.slug, 'travel_agency');
      expect(IntentService.parseMulti('أبي مكتب محاماة').first.slug, 'lawyer');
      expect(IntentService.parseMulti('أبي معرض سيارات').first.slug, 'car_dealer');
      expect(IntentService.parseMulti('أبي محل محمول').first.slug, 'mobile_phone');
    });

    test('تطابق مع البادئات العربية (ال/بال/لل)', () {
      expect(IntentService.parseMulti('وين المطعم').first.slug, 'restaurant');
      expect(IntentService.parseMulti('بالمول').first.slug, 'mall');
      expect(IntentService.parseMulti('للصيدلية').first.slug, 'pharmacy');
    });

    test('أطول كلمة مطابقة تفوز، مش أول فئة بالقائمة', () {
      // "مغسلة ملابس" أخص من "ملابس" لحالها
      expect(IntentService.parseMulti('أبي مغسلة ملابس').first.slug, 'laundry');
      expect(IntentService.parseMulti('أبي محل ملابس').first.slug, 'clothes');
      // "عيادة اسنان" أخص من "عيادة"
      expect(IntentService.parseMulti('أقرب عيادة اسنان').first.slug, 'dentist');
      expect(IntentService.parseMulti('أقرب عيادة').first.slug, 'clinic');
    });

    test('نية العروض منفصلة عن فئات الأماكن', () {
      final intents = IntentService.parseMulti('وش العروض القريبة؟');
      expect(intents.first.kind, IntentKind.deals);
    });
  });

  group('ردود الدردشة عند فشل التصنيف الذكي', () {
    test('التحية ما تصير بحث مطاعم', () {
      // هذا كان الخلل الأصلي: "هلا" ترجع نتائج مطاعم.
      for (final greeting in ['هلا', 'مرحبا', 'كيفك', 'شلونك', 'صباح الخير', 'وعليكم السلام']) {
        expect(route(greeting), 'chat', reason: greeting);
      }
    });

    test('أنواع الأسئلة الثانية لها ردود', () {
      const asks = {
        'شكراً': 'شكر',
        'مع السلامة': 'وداع',
        'مين انت': 'تعريف',
        'ساعدني': 'مساعدة',
        'فيه توصيل؟': 'توصيل',
        'وش رقمهم': 'تواصل',
        'كيف أوصل': 'اتجاهات',
        'كم السعر': 'أسعار',
        'متى يفتح': 'دوام',
        'بياناتي': 'خصوصية',
        'كم الساعة': 'برا الخدمة',
        'عندي محل': 'صاحب نشاط',
      };
      asks.forEach((ask, kind) {
        expect(route(ask), 'chat', reason: '$ask ($kind)');
      });
    });

    test('طلب حقيقي مع تحية بنفس الرسالة يظل بحث', () {
      expect(route('هلا، وين أقرب مطعم؟'), 'search');
      expect(route('شكرا بس أبي أرخص كافيه'), 'search');
    });

    test('كل رد ينتهي بدعوة لاستخدام ريكو', () {
      for (final ask in ['هلا', 'بياناتي', 'كم الساعة', 'فيه توصيل؟', 'مع السلامة']) {
        final reply = IntentService.detectOffTopicReply(ask)!;
        final lastLine = reply.trim().split('\n').last;
        expect(
          lastLine.contains('؟') ||
              lastLine.contains('قل لي') ||
              lastLine.contains('جرّب') ||
              lastLine.contains('اطلب') ||
              lastLine.contains('أمرك'),
          isTrue,
          reason: 'رد "$ask" خلص بلا دعوة: $lastLine',
        );
      }
    });

    test('الاستكمال يستخدم آخر فئة بدل التخمين', () {
      expect(route('أبعد شوي', last: 'cafe'), 'search');
      expect(IntentService.parseMulti('أبعد شوي', lastCategorySlug: 'cafe').first.slug, 'cafe');
    });
  });
}
