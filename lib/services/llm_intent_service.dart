import 'dart:convert';
import 'package:http/http.dart' as http;
import 'intent_service.dart';

/// نتيجة تصنيف الرسالة عبر الخادم الوسيط (Cloudflare Worker + Groq).
class LlmClassification {
  final bool isOffTopic;
  final String? reply;
  final String? categorySlug;
  final bool wantsCheapest;

  LlmClassification({
    required this.isOffTopic,
    this.reply,
    this.categorySlug,
    this.wantsCheapest = false,
  });

  QueryIntent? toQueryIntent() {
    if (categorySlug == null) return null;
    return IntentService.byCategorySlug(categorySlug!, wantsCheapest: wantsCheapest);
  }
}

/// يصنّف رسالة المستخدم عبر LLM (Groq) من خلال خادم وسيط يخفي مفتاح الـ API.
/// لا يُلقي أي استثناء أبداً؛ عند أي عطل (شبكة/مهلة/رد غير متوقع) يرجع null
/// ليستخدم المستدعي التصنيف المحلي القائم على الكلمات المفتاحية كخطة بديلة.
class LlmIntentService {
  static const String _proxyUrl =
      'https://rico-intent-proxy.rico-app-maher.workers.dev';

  static Future<LlmClassification?> classify(String message) async {
    try {
      final response = await http
          .post(
            Uri.parse(_proxyUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'message': message}),
          )
          .timeout(const Duration(seconds: 6));

      if (response.statusCode != 200) return null;

      final data = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      final category = data['category'] as String?;
      if (category == null) return null;

      if (category == 'off_topic') {
        return LlmClassification(isOffTopic: true, reply: data['reply'] as String?);
      }

      return LlmClassification(
        isOffTopic: false,
        categorySlug: category,
        wantsCheapest: data['wantsCheapest'] == true,
      );
    } catch (_) {
      return null;
    }
  }
}
