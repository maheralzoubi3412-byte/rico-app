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

  ResolvedIntent({
    required this.kind,
    this.category,
    this.rank = 'nearest',
    this.brandHint,
    this.customTagKey,
    this.customTagValue,
    this.label,
  });

  QueryIntent? toQueryIntent() {
    if (kind == 'deals') {
      return QueryIntent(kind: IntentKind.deals, label: label ?? 'العروض');
    }

    final rankMode = _rankFromString(rank);

    if (category == 'other') {
      if (customTagKey == null || customTagValue == null || label == null) return null;
      return QueryIntent(
        tags: [OsmTag(customTagKey!, customTagValue!)],
        label: label!,
        rank: rankMode,
        brandHint: brandHint,
      );
    }
    if (category == null) return null;
    return IntentService.byCategorySlug(category!, rank: rankMode, brandHint: brandHint);
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
  static const String _proxyUrl =
      'https://rico-intent-proxy.rico-app-maher.workers.dev';

  static Future<LlmClassification?> classify(
    String message, {
    List<Map<String, String>>? history,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse(_proxyUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'message': message,
              if (history != null && history.isNotEmpty) 'history': history,
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
        );
      }).toList();

      return LlmClassification(isOffTopic: false, intents: intents);
    } catch (_) {
      return null;
    }
  }
}
