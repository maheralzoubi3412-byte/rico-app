import 'package:flutter/foundation.dart';
import '../demo/demo_order.dart';
import '../services/intent_service.dart';
import 'deal.dart';
import 'place_result.dart';

enum MessageSender { user, bot }

class ChatMessage {
  final String text;
  final MessageSender sender;
  final List<PlaceResult>? places;
  final List<Deal>? deals;
  final bool isLoading;
  final DateTime timestamp;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// النية المفهومة أثناء التحميل — تُستخدم لعرض بطاقة "فهمت طلبك" (وسوم)
  /// فوق فقاعة التحميل قبل وصول النتائج الفعلية، وبعد الاستبدال بالنتيجة
  /// الفعلية تُستخدم لاشتقاق سبب الترشيح الحقيقي في RecommendedPickCard.
  final QueryIntent? understandingIntent;

  /// يُستدعى عند الضغط على "اطلبه" في بطاقة الترشيح — يبدأ عرض الطلب
  /// التجريبي الدائم (لا يوجد نظام طلبات حقيقي). null إن لم تكن هذه رسالة
  /// نتائج أماكن قابلة للطلب.
  final void Function(PlaceResult place)? onOrder;

  /// يُستدعى عند الضغط على حبة اقتراح سريع (مثل "أبغى أرخص") أسفل نتائج
  /// البحث — يعيد تشغيل خط أنابيب التصنيف الفعلي بنص مكافئ، وليس فلترة
  /// وهمية على النتائج المعروضة.
  final void Function(String suggestion)? onQuickReply;

  /// طلب تجريبي دائم (مراحل التأكيد والدفع والتتبّع) — لا يمثّل عملية حقيقية.
  /// يجب ألا تدخل الرسائل التي تحمل هذا الحقل في `_buildHistory()` أو ذاكرة
  /// الجلسة، حتى لا تُفسد تصنيف الطلبات الحقيقية اللاحقة.
  final DemoOrder? demoOrder;

  /// يُستدعى عند سحب SlideToConfirm في بطاقة الطلب التجريبية — ينقل
  /// [demoOrder] من مرحلة المراجعة إلى مرحلة التتبّع.
  final VoidCallback? onDemoConfirmed;

  ChatMessage({
    required this.text,
    required this.sender,
    this.places,
    this.deals,
    this.isLoading = false,
    this.actionLabel,
    this.onAction,
    this.understandingIntent,
    this.onOrder,
    this.onQuickReply,
    this.demoOrder,
    this.onDemoConfirmed,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  bool get isDemo => demoOrder != null;

  ChatMessage copyWith({
    String? text,
    bool? isLoading,
    DemoOrder? demoOrder,
  }) {
    return ChatMessage(
      text: text ?? this.text,
      sender: sender,
      places: places,
      deals: deals,
      isLoading: isLoading ?? this.isLoading,
      actionLabel: actionLabel,
      onAction: onAction,
      understandingIntent: understandingIntent,
      onOrder: onOrder,
      onQuickReply: onQuickReply,
      demoOrder: demoOrder ?? this.demoOrder,
      onDemoConfirmed: onDemoConfirmed,
      timestamp: timestamp,
    );
  }
}
