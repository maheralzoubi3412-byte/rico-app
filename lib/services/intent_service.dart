/// زوج وسم OpenStreetMap (key=value) يمكن مطابقته في Overpass
class OsmTag {
  final String key;
  final String value;
  const OsmTag(this.key, this.value);
}

/// طريقة ترتيب النتائج المطلوبة. best_rated غير مفعّلة فعلياً بعد (تحتاج
/// بيانات تقييم حقيقية غير متوفرة في OSM) — محجوزة للمرحلة القادمة.
enum RankMode { nearest, cheapest, openNow, bestRated }

/// نوع النية: بحث عن مكان، أو استفسار عن عروض/خصومات (لا يرتبط بفئة مكان).
enum IntentKind { place, deals }

/// نية واحدة من نوايا رسالة المستخدم (قد تحتوي الرسالة الواحدة عدة نوايا،
/// انظر [IntentService.parseMulti]).
class QueryIntent {
  final IntentKind kind;
  final List<OsmTag> tags; // فارغة لنوايا kind=deals
  final String label; // اسم عربي مفهوم للعرض في الرد
  final RankMode rank;
  final String? brandHint;
  final String? slug; // null لنوايا deals وللفئات الحرة (other) غير الثابتة

  QueryIntent({
    this.kind = IntentKind.place,
    this.tags = const [],
    required this.label,
    this.rank = RankMode.nearest,
    this.brandHint,
    this.slug,
  });

  bool get wantsCheapest => rank == RankMode.cheapest;
  bool get wantsOpenNow => rank == RankMode.openNow;
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

  // كلمات تدل على نية "عروض/خصومات" (بحث منفصل عن أي فئة مكان)
  static final RegExp _dealsWords = RegExp('عروض|عرض|خصم|خصومات');

  // فاصل بين نوايا متعددة في رسالة واحدة: "و"/"أو" كمحرف مستقل (بمسافة على
  // الجانبين لتفادي قطع كلمات تبدأ بـ"و" مثل "وايش")، أو فاصلة عربية/إنجليزية
  static final RegExp _intentSeparator = RegExp(r'\s+(?:و|أو)\s+|،|,');

  // أقصى عدد نوايا نستخرجها من رسالة واحدة، يطابق الحد نفسه في مصنّف الـLLM
  static const int _maxIntents = 3;

  static RankMode _detectRank(String text) {
    if (RegExp(r'مفتوح الحين|مفتوح الآن|مفتوح الان|فاتح الحين|فاتح الآن|فاتح الان').hasMatch(text)) {
      return RankMode.openNow;
    }
    if (RegExp(r'أرخص|ارخص|أوفر|اوفر|رخيص').hasMatch(text)) {
      return RankMode.cheapest;
    }
    return RankMode.nearest;
  }

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

    return QueryIntent(
      tags: chosen['tags'] as List<OsmTag>,
      label: chosen['label'] as String,
      rank: _detectRank(text),
      slug: chosen['slug'] as String,
    );
  }

  /// يفكك رسالة واحدة إلى عدة نوايا مستقلة إذا جمعت أكثر من طلب (مثال:
  /// "أقرب مطعم أو أرخص كافيه، وايش العروض المتوفرة؟" → ٣ نوايا مستقلة).
  /// هذا مسار بديل محلي يُستخدم فقط عند فشل مصنّف الـLLM؛ لا يحاول فصل نية
  /// مكان عن نية عروض مذكورتين معاً داخل نفس الجزء النصي (مثال: "مطعم فيه
  /// عروض" تُعامل كنية عروض فقط) — الفصل الدقيق متروك لمصنّف الـLLM.
  static List<QueryIntent> parseMulti(String rawText, {String? lastCategorySlug}) {
    final text = rawText.trim();
    if (text.isEmpty) return [];

    final fragments = text
        .split(_intentSeparator)
        .map((f) => f.trim())
        .where((f) => f.isNotEmpty)
        .toList();

    if (fragments.isEmpty) {
      return [parse(text, lastCategorySlug: lastCategorySlug)];
    }

    final intents = <QueryIntent>[];
    for (final fragment in fragments) {
      if (_dealsWords.hasMatch(fragment)) {
        intents.add(QueryIntent(kind: IntentKind.deals, label: 'العروض'));
      } else {
        intents.add(parse(fragment, lastCategorySlug: lastCategorySlug));
      }
    }

    return intents.take(_maxIntents).toList();
  }

  /// يبني QueryIntent من فئة معروفة (slug)، تستخدم لتحويل نتيجة تصنيف LLM
  /// إلى نية بحث فعلية.
  static QueryIntent? byCategorySlug(
    String slug, {
    RankMode rank = RankMode.nearest,
    String? brandHint,
  }) {
    for (final category in _categories) {
      if (category['slug'] == slug) {
        return QueryIntent(
          tags: category['tags'] as List<OsmTag>,
          label: category['label'] as String,
          rank: rank,
          brandHint: brandHint,
          slug: slug,
        );
      }
    }
    return null;
  }
}
