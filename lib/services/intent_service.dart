/// زوج وسم OpenStreetMap (key=value) يمكن مطابقته في Overpass
class OsmTag {
  final String key;
  final String value;
  const OsmTag(this.key, this.value);
}

/// نية المستخدم بعد تحليل رسالته
class QueryIntent {
  final List<OsmTag> tags; // كل الوسوم البديلة المقبولة لهذه الفئة
  final String label; // اسم عربي مفهوم للعرض في الرد
  final bool wantsCheapest;

  QueryIntent({
    required this.tags,
    required this.label,
    this.wantsCheapest = false,
  });
}

class IntentService {
  // خريطة كلمات مفتاحية عربية شائعة في السعودية → فئة تحتوي عدة وسوم OSM بديلة
  // (وسم واحد يفوّت أماكناً حقيقية موسومة بشكل مختلف قليلاً في البيانات)
  // مرجع الوسوم: https://wiki.openstreetmap.org/wiki/Map_features
  static final List<Map<String, Object>> _categories = [
    {
      'slug': 'restaurant',
      'tags': [const OsmTag('amenity', 'restaurant'), const OsmTag('amenity', 'fast_food')],
      'label': 'مطعم',
      'words': 'مطعم|مطاعم|اكل|أكل|طعام|غداء|عشاء|فطور|جوعان|جوعانة|وجبة',
    },
    {
      'slug': 'cafe',
      'tags': [const OsmTag('amenity', 'cafe')],
      'label': 'كافيه',
      'words': 'قهوة|كافيه|كافي|كوفي|مقهى|قهاوي',
    },
    {
      'slug': 'pharmacy',
      'tags': [const OsmTag('amenity', 'pharmacy')],
      'label': 'صيدلية',
      'words': 'صيدلية|صيدليه|دواء|أدوية',
    },
    {
      'slug': 'supermarket',
      'tags': [
        const OsmTag('shop', 'supermarket'),
        const OsmTag('shop', 'convenience'),
        const OsmTag('shop', 'grocery'),
      ],
      'label': 'سوبرماركت',
      'words': 'سوبرماركت|بقالة|بقاله|هايبر|هايبرماركت',
    },
    {
      'slug': 'fuel',
      'tags': [const OsmTag('amenity', 'fuel')],
      'label': 'محطة بنزين',
      'words': 'بنزين|محطة وقود|محطة بترول|تعبئة',
    },
    {
      'slug': 'mall',
      'tags': [const OsmTag('shop', 'mall'), const OsmTag('shop', 'department_store')],
      'label': 'مول',
      'words': 'مول|مركز تسوق|مولات',
    },
    {
      'slug': 'atm',
      'tags': [const OsmTag('amenity', 'atm')],
      'label': 'صراف',
      'words': 'صراف|ماكينة صراف|ATM',
    },
    {
      'slug': 'bank',
      'tags': [const OsmTag('amenity', 'bank')],
      'label': 'بنك',
      'words': 'بنك|بنوك',
    },
    {
      'slug': 'hospital',
      'tags': [const OsmTag('amenity', 'hospital')],
      'label': 'مستشفى',
      'words': 'مستشفى|طوارئ|مستشفيات',
    },
    {
      'slug': 'clinic',
      'tags': [const OsmTag('amenity', 'clinic'), const OsmTag('amenity', 'doctors')],
      'label': 'عيادة',
      'words': 'عيادة|عيادات',
    },
    {
      'slug': 'fitness_centre',
      'tags': [const OsmTag('leisure', 'fitness_centre'), const OsmTag('leisure', 'sports_centre')],
      'label': 'نادي رياضي',
      'words': 'جيم|نادي رياضي|صالة رياضية',
    },
  ];

  static QueryIntent parse(String rawText) {
    final text = rawText.trim();

    // افتراضي منطقي لأغلب الاستخدام: مطعم
    var chosen = _categories.first;

    for (final category in _categories) {
      final words = (category['words'] as String).split('|');
      if (words.any((w) => text.contains(w))) {
        chosen = category;
        break;
      }
    }

    final wantsCheapest =
        RegExp(r'أرخص|ارخص|أوفر|اوفر|عرض|عروض|رخيص').hasMatch(text);

    return QueryIntent(
      tags: chosen['tags'] as List<OsmTag>,
      label: chosen['label'] as String,
      wantsCheapest: wantsCheapest,
    );
  }

  /// يبني QueryIntent من فئة معروفة (slug)، تستخدم لتحويل نتيجة تصنيف LLM
  /// إلى نية بحث فعلية.
  static QueryIntent? byCategorySlug(String slug, {bool wantsCheapest = false}) {
    for (final category in _categories) {
      if (category['slug'] == slug) {
        return QueryIntent(
          tags: category['tags'] as List<OsmTag>,
          label: category['label'] as String,
          wantsCheapest: wantsCheapest,
        );
      }
    }
    return null;
  }
}
