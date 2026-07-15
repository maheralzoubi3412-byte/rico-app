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
  final bool wantsOpenNow;
  final String? brandHint;
  final String? slug; // null للفئات الحرة (other) غير الثابتة

  QueryIntent({
    required this.tags,
    required this.label,
    this.wantsCheapest = false,
    this.wantsOpenNow = false,
    this.brandHint,
    this.slug,
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

  // كلمات تدل على أن الرسالة استكمال لطلب سابق وليست طلباً جديداً مستقلاً
  // (تستخدم فقط عند فشل مطابقة أي كلمة فئة وتوفر فئة سابقة من نفس الجلسة)
  static const String _continuationWords = 'نفس الشي|نفس الشيء|زيادة|أبعد|ابعد|أكثر|اكثر|غيره|غيرها';

  static QueryIntent parse(String rawText, {String? lastCategorySlug}) {
    final text = rawText.trim();

    Map<String, Object>? chosen;

    for (final category in _categories) {
      final words = (category['words'] as String).split('|');
      if (words.any((w) => text.contains(w))) {
        chosen = category;
        break;
      }
    }

    // لا كلمة فئة صريحة، لكن الرسالة تبدو استكمالاً لطلب سابق: أعد استخدام
    // آخر فئة معروفة بدل الرجوع الصامت لـ"مطعم" كافتراضي غير مبرر
    if (chosen == null && lastCategorySlug != null && RegExp(_continuationWords).hasMatch(text)) {
      chosen = _categories.firstWhere(
        (c) => c['slug'] == lastCategorySlug,
        orElse: () => _categories.first,
      );
    }

    // افتراضي منطقي لأغلب الاستخدام إذا لم تُطابق أي فئة ولا استكمال: مطعم
    chosen ??= _categories.first;

    final wantsCheapest =
        RegExp(r'أرخص|ارخص|أوفر|اوفر|عرض|عروض|رخيص').hasMatch(text);
    final wantsOpenNow =
        RegExp(r'مفتوح الحين|مفتوح الآن|مفتوح الان|فاتح الحين|فاتح الآن|فاتح الان').hasMatch(text);

    return QueryIntent(
      tags: chosen['tags'] as List<OsmTag>,
      label: chosen['label'] as String,
      wantsCheapest: wantsCheapest,
      wantsOpenNow: wantsOpenNow,
      slug: chosen['slug'] as String,
    );
  }

  /// يبني QueryIntent من فئة معروفة (slug)، تستخدم لتحويل نتيجة تصنيف LLM
  /// إلى نية بحث فعلية.
  static QueryIntent? byCategorySlug(
    String slug, {
    bool wantsCheapest = false,
    bool wantsOpenNow = false,
    String? brandHint,
  }) {
    for (final category in _categories) {
      if (category['slug'] == slug) {
        return QueryIntent(
          tags: category['tags'] as List<OsmTag>,
          label: category['label'] as String,
          wantsCheapest: wantsCheapest,
          wantsOpenNow: wantsOpenNow,
          brandHint: brandHint,
          slug: slug,
        );
      }
    }
    return null;
  }
}
