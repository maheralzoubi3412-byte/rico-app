/// طريقة ترتيب النتائج المطلوبة. best_rated غير مفعّلة فعلياً بعد (تحتاج
/// بيانات تقييم حقيقية غير متوفرة دوماً).
enum RankMode { nearest, cheapest, openNow, bestRated }

/// نوع النية: بحث عن مكان، أو استفسار عن عروض/خصومات (لا يرتبط بفئة مكان).
enum IntentKind { place, deals }

/// نية واحدة من نوايا رسالة المستخدم (قد تحتوي الرسالة الواحدة عدة نوايا،
/// انظر [IntentService.parseMulti]).
class QueryIntent {
  final IntentKind kind;
  final String label; // اسم عربي مفهوم للعرض في الرد
  final RankMode rank;
  final String? brandHint;
  final String? slug; // null لنوايا deals وللفئات الحرة (other) غير الثابتة

  /// رقم ترتيب عنصر من "آخر نتائج معروضة" أشار له المستخدم صراحة (مثل
  /// "الثاني")، أو null لطلب بحث عادي. عند تحديده يُحل من الذاكرة المحلية
  /// (بدون بحث شبكي جديد) في شاشة الدردشة.
  final int? referencedPosition;

  QueryIntent({
    this.kind = IntentKind.place,
    required this.label,
    this.rank = RankMode.nearest,
    this.brandHint,
    this.slug,
    this.referencedPosition,
  });

  bool get wantsCheapest => rank == RankMode.cheapest;
  bool get wantsOpenNow => rank == RankMode.openNow;
}

class IntentService {
  // خريطة كلمات مفتاحية عربية شائعة بالأردن → فئة (نفس الفئات الثابتة
  // المعرّفة في CATEGORIES بـclassify.constants.ts على الخادم، وGOOGLE_TYPE_BY_
  // CATEGORY بـgoogle-places.adapter.ts — أي فئة تُضاف هناك يجب أن تُضاف هنا
  // أيضاً وإلا فشل IntentService.byCategorySlug بإرجاع null لها).
  static final List<Map<String, Object>> _categories = [
    {
      'slug': 'restaurant',
      'label': 'مطعم',
      'words': 'مطعم|مطاعم|اكل|أكل|طعام|غداء|عشاء|فطور|جوعان|جوعانة|وجبة',
    },
    {
      'slug': 'cafe',
      'label': 'كافيه',
      'words': 'قهوة|كافيه|كافي|كوفي|مقهى|قهاوي',
    },
    {
      'slug': 'pharmacy',
      'label': 'صيدلية',
      'words': 'صيدلية|صيدليه|دواء|أدوية',
    },
    {
      'slug': 'supermarket',
      'label': 'سوبرماركت',
      'words': 'سوبرماركت|بقالة|بقاله|هايبر|هايبرماركت',
    },
    {
      'slug': 'fuel',
      'label': 'محطة بنزين',
      'words': 'بنزين|محطة وقود|محطة بترول|تعبئة',
    },
    {
      'slug': 'mall',
      'label': 'مول',
      'words': 'مول|مركز تسوق|مولات',
    },
    {
      'slug': 'clothes',
      'label': 'محل ملابس',
      'words': 'ملابس|عبايات|ثياب|بدلة|فستان',
    },
    {
      'slug': 'mobile_phone',
      'label': 'محل جوالات',
      'words': 'جوال|جوالات|موبايل|آيفون|ايفون',
    },
    {
      'slug': 'electronics',
      'label': 'محل إلكترونيات',
      'words': 'الكترونيات|إلكترونيات|كهربائيات|أجهزة كهربائية',
    },
    {
      'slug': 'atm',
      'label': 'صراف',
      'words': 'صراف|ماكينة صراف|ATM',
    },
    {
      'slug': 'bank',
      'label': 'بنك',
      'words': 'بنك|بنوك',
    },
    {
      // يجب أن تُفحص قبل clinic: "عيادة اسنان" تحتوي كلمة "عيادة" التي
      // تطابق أيضاً كلمات clinic، والفحص يتوقف عند أول فئة مطابقة
      'slug': 'dentist',
      'label': 'عيادة أسنان',
      'words': 'اسنان|أسنان|طبيب اسنان|طبيب أسنان|دكتور اسنان',
    },
    {
      'slug': 'hospital',
      'label': 'مستشفى',
      'words': 'مستشفى|طوارئ|مستشفيات',
    },
    {
      'slug': 'clinic',
      'label': 'عيادة',
      'words': 'عيادة|عيادات',
    },
    {
      'slug': 'hairdresser',
      'label': 'صالون حلاقة',
      'words': 'حلاق|حلاقة|صالون رجالي',
    },
    {
      'slug': 'beauty',
      'label': 'صالون تجميل',
      'words': 'صالون نسائي|تجميل|مانكير|مكياج|كوافير',
    },
    {
      'slug': 'car_wash',
      'label': 'مغسلة سيارات',
      'words': 'مغسلة سيارات|غسيل سيارة|غسيل سيارتي|غسيل سيارات',
    },
    {
      'slug': 'fitness_centre',
      'label': 'نادي رياضي',
      'words': 'جيم|نادي رياضي|صالة رياضية',
    },
    {
      'slug': 'hotel',
      'label': 'فندق',
      'words': 'فندق|فنادق|شقة مفروشة|شقق مفروشة|إقامة|استراحة',
    },
    {
      'slug': 'mosque',
      'label': 'مسجد',
      'words': 'مسجد|مساجد|جامع',
    },
    {
      'slug': 'park',
      'label': 'حديقة',
      'words': 'حديقة|حدائق|منتزه|متنزه',
    },
    {
      'slug': 'bakery',
      'label': 'مخبز',
      'words': 'مخبز|مخابز|فطاير|فطائر',
    },
    {
      'slug': 'sweets',
      'label': 'محل حلويات',
      'words': 'حلويات|حلا|بقلاوة|شوكولاتة|كنافة',
    },
    {
      'slug': 'bookstore',
      'label': 'مكتبة',
      'words': 'مكتبة|كتب|مكتبات',
    },
    {
      'slug': 'toy_store',
      'label': 'محل ألعاب أطفال',
      'words': 'العاب اطفال|ألعاب أطفال|لعب اطفال',
    },
    {
      'slug': 'pet_store',
      'label': 'محل حيوانات أليفة',
      'words': 'بيت شوب|محل حيوانات|طيور واسماك',
    },
    {
      'slug': 'jewelry_store',
      'label': 'محل مجوهرات',
      'words': 'مجوهرات|ذهب|جواهرجي|مصاغ',
    },
    {
      'slug': 'furniture_store',
      'label': 'محل أثاث',
      'words': 'اثاث|أثاث|موبيليا|عفش',
    },
    {
      'slug': 'shoe_store',
      'label': 'محل أحذية',
      'words': 'جزمة|احذية|أحذية|شوزات',
    },
    {
      'slug': 'gift_shop',
      'label': 'محل هدايا',
      'words': 'هدايا|هدية',
    },
    {
      'slug': 'florist',
      'label': 'محل ورد',
      'words': 'ورد|زهور|بائع ورد|زهرية',
    },
    {
      'slug': 'laundry',
      'label': 'مغسلة ملابس',
      'words': 'مغسلة ملابس|كوي|تنظيف جاف',
    },
    {
      'slug': 'veterinary',
      'label': 'عيادة بيطرية',
      'words': 'بيطري|عيادة حيوانات|دكتور حيوانات',
    },
    {
      'slug': 'car_repair',
      'label': 'كراج تصليح سيارات',
      'words': 'كراج|تصليح سيارات|ميكانيكي|تواير|بنشر',
    },
    {
      'slug': 'car_dealer',
      'label': 'معرض سيارات',
      'words': 'معرض سيارات|بيع سيارات|شراء سيارات',
    },
    {
      'slug': 'car_rental',
      'label': 'تأجير سيارات',
      'words': 'تأجير سيارات|رنت كار|ايجار سيارة',
    },
    {
      'slug': 'parking',
      'label': 'موقف سيارات',
      'words': 'موقف سيارات|باركنج|كراج مواقف',
    },
    {
      'slug': 'lawyer',
      'label': 'محامي',
      'words': 'محامي|مكتب محاماة|محاماة',
    },
    {
      'slug': 'real_estate',
      'label': 'مكتب عقارات',
      'words': 'عقار|عقارات|مكتب عقاري|مكتب عقارات',
    },
    {
      'slug': 'travel_agency',
      'label': 'مكتب سفريات',
      'words': 'سفريات|حجوزات|وكالة سفر|مكتب سفر',
    },
    {
      'slug': 'insurance',
      'label': 'شركة تأمين',
      'words': 'تأمين|شركة تأمين|بوليصة',
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
      label: chosen['label'] as String,
      rank: _detectRank(text),
      slug: chosen['slug'] as String,
    );
  }

  /// يفكك رسالة واحدة إلى عدة نوايا مستقلة إذا جمعت أكثر من طلب (مثال:
  /// "أقرب مطعم أو أرخص كافيه، وشو العروض الموجودة؟" → ٣ نوايا مستقلة).
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
    int? referencedPosition,
  }) {
    for (final category in _categories) {
      if (category['slug'] == slug) {
        return QueryIntent(
          label: category['label'] as String,
          rank: rank,
          brandHint: brandHint,
          slug: slug,
          referencedPosition: referencedPosition,
        );
      }
    }
    return null;
  }
}
