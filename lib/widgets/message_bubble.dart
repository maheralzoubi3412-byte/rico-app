import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/chat_message.dart';
import '../models/deal.dart';
import '../models/place_result.dart';
import '../services/intent_service.dart';
import '../theme/app_theme.dart';
import 'catalog_flow_card.dart';
import 'chat_pill_chip.dart';
import 'recommended_pick_card.dart';
import 'understanding_card.dart';
import 'working_steps_card.dart';

class MessageBubble extends StatelessWidget {
  final ChatMessage message;

  const MessageBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.sender == MessageSender.user;

    // بطاقة "فهمت طلبك" تُعرض بمفردها بدل فقاعة الدردشة المعتادة (مطابقةً
    // لتصميم RICO GO حيث تظهر كبطاقة مستقلة).
    final skipBubble = message.isLoading && message.understandingIntent != null;

    return Align(
      alignment: isUser ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        child: Column(
          crossAxisAlignment: isUser ? CrossAxisAlignment.start : CrossAxisAlignment.end,
          children: [
            if (!skipBubble)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                decoration: BoxDecoration(
                  color: isUser ? ChatColors.accentDark : ChatColors.botBubble,
                  borderRadius: BorderRadius.circular(18),
                  border: isUser ? null : Border.all(color: ChatColors.borderSubtle),
                ),
                child: message.isLoading
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(
                            width: 15,
                            height: 15,
                            child: CircularProgressIndicator(strokeWidth: 2, color: ChatColors.accentBright),
                          ),
                          if (message.text.isNotEmpty) ...[
                            const SizedBox(width: 10),
                            Flexible(
                              child: Text(message.text,
                                  style: const TextStyle(color: ChatColors.textMuted, fontSize: 14.5)),
                            ),
                          ],
                        ],
                      )
                    : Text(
                        message.text,
                        style: TextStyle(
                          color: isUser ? Colors.white : ChatColors.textPrimary,
                          fontSize: 14.5,
                        ),
                      ),
              ),
            if (message.understandingIntent != null && message.isLoading) ...[
              UnderstandingCard(intent: message.understandingIntent!),
              WorkingStepsCard(
                searchLabel: message.understandingIntent!.kind == IntentKind.deals
                    ? 'العروض'
                    : message.understandingIntent!.label,
              ),
            ],
            if (message.actionLabel != null && message.onAction != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: OutlinedButton(
                  onPressed: message.onAction,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: ChatColors.accentBright,
                    side: const BorderSide(color: ChatColors.accentBright),
                    minimumSize: const Size(0, 40),
                  ),
                  child: Text(message.actionLabel!),
                ),
              ),
            if (message.places != null && message.places!.isNotEmpty)
              _PlacesResults(
                places: message.places!,
                intent: message.understandingIntent,
                onOrder: message.onOrder,
                onQuickReply: message.onQuickReply,
              ),
            if (message.deals != null && message.deals!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  children: [for (final deal in message.deals!) _CompactDealCard(deal: deal)],
                ),
              ),
            if (message.requestFlow != null)
              CatalogFlowCard(
                flow: message.requestFlow!,
                onSelectItem: message.onSelectCatalogItem,
                onConfirm: message.onConfirmRequest,
                onCancel: message.onCancelCatalogSelection,
              ),
          ],
        ),
      ),
    );
  }
}

class _PlacesResults extends StatelessWidget {
  final List<PlaceResult> places;
  final QueryIntent? intent;
  final void Function(PlaceResult place)? onOrder;
  final void Function(String suggestion)? onQuickReply;

  const _PlacesResults({
    required this.places,
    required this.intent,
    required this.onOrder,
    required this.onQuickReply,
  });

  @override
  Widget build(BuildContext context) {
    final first = places.first;
    final rest = places.skip(1).toList();
    final resolvedIntent = intent;
    final resolvedOnOrder = onOrder;
    final resolvedOnQuickReply = onQuickReply;

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // بطاقة "ترشيح ريكو" وزر تصفّح المنتجات/العروض لا تظهر إلا لنشاط
          // حقيقي من قاعدتنا (source == 'rico') — نتيجة OSM الاحتياطية لا
          // يقابلها نشاط تجاري فعلي بمنتجات حقيقية لعرضها.
          if (resolvedIntent != null && resolvedOnOrder != null && first.source == 'rico')
            RecommendedPickCard(place: first, intent: resolvedIntent, onOrder: () => resolvedOnOrder(first))
          else
            _CompactPlaceCard(
              place: first,
              rank: 1,
              onViewCatalog: first.source == 'rico' && resolvedOnOrder != null ? () => resolvedOnOrder(first) : null,
            ),
          for (var i = 0; i < rest.length; i++)
            _CompactPlaceCard(
              place: rest[i],
              rank: i + 2,
              onViewCatalog: rest[i].source == 'rico' && resolvedOnOrder != null ? () => resolvedOnOrder(rest[i]) : null,
            ),
          if (resolvedOnQuickReply != null) ...[
            const SizedBox(height: 10),
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 8,
              runSpacing: 8,
              children: [
                ChatPillChip(label: 'بدي أرخص', onTap: () => resolvedOnQuickReply('بدي أرخص')),
                ChatPillChip(label: 'بدي أسرع', onTap: () => resolvedOnQuickReply('بدي الأقرب')),
                ChatPillChip(label: 'ورّني خيارات تانية', onTap: () => resolvedOnQuickReply('ورّني خيارات تانية')),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CompactPlaceCard extends StatelessWidget {
  final PlaceResult place;
  final int rank;
  final VoidCallback? onViewCatalog;

  const _CompactPlaceCard({required this.place, required this.rank, this.onViewCatalog});

  Future<void> _openDirections() async {
    final uri = Uri.parse(place.directionsUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ChatColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ChatColors.borderSubtle),
      ),
      child: InkWell(
        onTap: _openDirections,
        borderRadius: BorderRadius.circular(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 14,
                  backgroundColor: ChatColors.accent.withValues(alpha: 0.16),
                  child: Text('$rank',
                      style: const TextStyle(color: ChatColors.accentBright, fontWeight: FontWeight.bold, fontSize: 12)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(place.name,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                              color: ChatColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13.5)),
                      const SizedBox(height: 4),
                      Wrap(
                        alignment: WrapAlignment.end,
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          if (place.ratingLabel != null)
                            Text(place.ratingLabel!, style: const TextStyle(color: ChatColors.gold, fontSize: 11.5)),
                          if (place.priceLevelLabel != null)
                            Text(place.priceLevelLabel!,
                                style: const TextStyle(color: ChatColors.textMuted, fontSize: 11.5)),
                          if (place.distanceMeters != null)
                            Text(place.distanceLabel, style: const TextStyle(color: ChatColors.textMuted, fontSize: 11.5)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (onViewCatalog != null) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: onViewCatalog,
                  style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4)),
                  child: const Text('عرض المنتجات والعروض',
                      style: TextStyle(color: ChatColors.accentBright, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CompactDealCard extends StatelessWidget {
  final Deal deal;

  const _CompactDealCard({required this.deal});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ChatColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ChatColors.gold.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(color: ChatColors.gold.withValues(alpha: 0.14), shape: BoxShape.circle),
            child: const Icon(Icons.local_offer, size: 14, color: ChatColors.gold),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(deal.placeName,
                    textAlign: TextAlign.right,
                    style: const TextStyle(color: ChatColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13.5)),
                const SizedBox(height: 2),
                Text(deal.titleAr,
                    textAlign: TextAlign.right,
                    style: const TextStyle(color: ChatColors.gold, fontSize: 12.5, fontWeight: FontWeight.w600)),
                if (deal.descriptionAr != null && deal.descriptionAr!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(deal.descriptionAr!,
                        textAlign: TextAlign.right, style: const TextStyle(color: ChatColors.textMuted, fontSize: 11.5)),
                  ),
                if (deal.distanceMeters != null || deal.promoCode != null) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    alignment: WrapAlignment.end,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      if (deal.distanceMeters != null)
                        Text(deal.distanceLabel, style: const TextStyle(color: ChatColors.textMuted, fontSize: 11)),
                      if (deal.promoCode != null)
                        Text(deal.promoCode!, style: const TextStyle(color: ChatColors.textMuted, fontSize: 11)),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
