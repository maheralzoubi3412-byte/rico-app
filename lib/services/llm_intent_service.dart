import 'dart:convert';
import 'package:http/http.dart' as http;
import 'intent_service.dart';

/// نية واحدة مفكوكة من رد المصنّف (LLM)، قد تمثّل بحثاً عن مكان أو طلب عروض.
/// رسالة واحدة قد تحتوي عدة نوايا (انظر [LlmClassification.intents]).
class ResolvedIntent {
  final String kind; // 'place' | 'deals'
  final String? category;
  final String rank; // 'nearest' | 'cheapest' | 'open_now' | 'best_rated'
  final String? brandHint;
  final String? customTagKey;
  final String? customTagValue;
  final String? label;
  final int? referencedPosition;

  ResolvedIntent({
    required this.kind,
    this.category,
    this.rank = 'nearest',
    this.brandHint,
    this.customTagKey,
    this.customTagValue,
    this.label,
    this.referencedPosition,
  });

  QueryIntent? toQueryIntent() {
    if (kind == 'deals') {
      return QueryIntent(kind: IntentKind.deals, label: label ?? 'العروض', referencedPosition: referencedPosition);
    }

    final rankMode = _rankFromString(rank);

    if (category == 'other') {
      if (customTagKey == null || customTagValue == null || label == null) return null;
      return QueryIntent(
        label: label!,
        rank: rankMode,
        brandHint: brandHint,
        // نفس قيمة وسم OSM (مثل "hairdresser") تُستخدم كـcategorySlug عند
        // البحث في قاعدة ريكو أولاً — تماماً كما تفعل الفئات الثابتة
        // (restaurant/cafe/hotel...) — قبل السقوط لـOverpass إذا لم يوجد
        // نشاط مسجّل بهذه الفئة بعد.
        slug: customTagValue,
        referencedPosition: referencedPosition,
      );
    }
    if (category == null) return null;
    return IntentService.byCategorySlug(
      category!,
      rank: rankMode,
      brandHint: brandHint,
      referencedPosition: referencedPosition,
    );
  }

  static RankMode _rankFromString(String value) {
    switch (value) {
      case 'cheapest':
        return RankMode.cheapest;
      case 'open_now':
        return RankMode.openNow;
      case 'best_rated':
        return RankMode.bestRated;
      default:
        return RankMode.nearest;
    }
  }
}

/// نتيجة تصنيف الرسالة عبر الخادم الوسيط (Cloudflare Worker + Groq) — قد
/// تحتوي أكثر من نية واحدة إذا جمعت الرسالة أكثر من طلب مستقل.
class LlmClassification {
  final bool isOffTopic;
  final String? reply;
  final List<ResolvedIntent> intents;

  LlmClassification({
    required this.isOffTopic,
    this.reply,
    this.intents = const [],
  });

  List<QueryIntent> toQueryIntents() =>
      intents.map((i) => i.toQueryIntent()).whereType<QueryIntent>().toList();
}

/// يصنّف رسالة المستخدم عبر LLM (Groq) من خلال خادم وسيط يخفي مفتاح الـ API.
/// لا يُلقي أي استثناء أبداً؛ عند أي عطل (شبكة/مهلة/رد غير متوقع) يرجع null
/// ليستخدم المستدعي التصنيف المحلي القائم على الكلمات المفتاحية كخطة بديلة.
class LlmIntentService {
  // rico-backend (NestJS، يستبدل rico-intent-proxy القديم) يعرض هذا التصنيف
  // على المسار /classify (وليس الجذر كما كان الحال في الـ Worker القديم).
  // للتجربة المحلية بدّلها لـ http://localhost:3000/classify (iOS
  // Simulator/سطح المكتب) أو http://10.0.2.2:3000/classify (Android Emulator).
  static const String _proxyUrl = 'https://app.rico-go.com/classify';

  static Future<LlmClassification?> classify(
    String message, {
    List<Map<String, String>>? history,
    Map<String, dynamic>? lastResults,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse(_proxyUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'message': message,
              if (history != null && history.isNotEmpty) 'history': history,
              if (lastResults != null) 'lastResults': lastResults,
            }),
          )
          .timeout(const Duration(seconds: 6));

      if (response.statusCode != 200) return null;

      final data = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;

      if (data['offTopic'] == true) {
        return LlmClassification(isOffTopic: true, reply: data['reply'] as String?);
      }

      final rawIntents = (data['intents'] as List?) ?? [];
      if (rawIntents.isEmpty) return null;

      final intents = rawIntents.map((raw) {
        final map = raw as Map<String, dynamic>;
        final customTag = map['customTag'] as Map<String, dynamic>?;
        return ResolvedIntent(
          kind: map['kind'] as String? ?? 'place',
          category: map['category'] as String?,
          rank: map['rank'] as String? ?? 'nearest',
          brandHint: map['brandHint'] as String?,
          customTagKey: customTag?['key'] as String?,
          customTagValue: customTag?['value'] as String?,
          label: map['label'] as String?,
          referencedPosition: map['referencedPosition'] as int?,
        );
      }).toList();

      return LlmClassification(isOffTopic: false, intents: intents);
    } catch (_) {
      return null;
    }
  }
}
