import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/place_result.dart';
import '../services/intent_service.dart';
import '../theme/app_theme.dart';

/// بطاقة الترشيح الأول المميّزة — النص التوضيحي "ليش رشّحته" مشتق من سبب
/// الترتيب الفعلي ([QueryIntent.rank]) وتوفر بيانات [place] الحقيقية فقط،
/// لا صياغة تسويقية مختلقة. الزر الثانوي يفتح اتجاهات خرائط جوجل الحقيقية
/// بدل رابط قائمة طعام غير موجود فعلياً.
class RecommendedPickCard extends StatelessWidget {
  final PlaceResult place;
  final QueryIntent intent;
  final VoidCallback onOrder;

  const RecommendedPickCard({
    super.key,
    required this.place,
    required this.intent,
    required this.onOrder,
  });

  String get _reasonAr {
    switch (intent.rank) {
      case RankMode.cheapest:
        return place.priceLevel != null
            ? 'الأرخص ضمن ${intent.label} القريبة منك حسب بيانات الأسعار المتوفرة'
            : 'الأقرب لك ضمن ${intent.label} — الأقرب غالباً أوفر بسبب توفير وقت ومشوار';
      case RankMode.bestRated:
        return place.rating != null
            ? 'الأعلى تقييماً (${place.ratingLabel}) ضمن ${intent.label} القريبة منك'
            : 'أفضل خيار متاح ضمن ${intent.label} القريبة منك';
      case RankMode.openNow:
        return 'من أقرب ${intent.label} المؤكَّد أنها مفتوحة الآن';
      case RankMode.nearest:
        return 'الأقرب لموقعك الحالي ضمن ${intent.label}';
    }
  }

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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ChatColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ChatColors.accentBright.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: ChatColors.accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text('ترشيح ريكو ✓',
                    style: TextStyle(color: ChatColors.accentBright, fontSize: 11.5, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(place.name,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          if (place.address.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(place.address,
                textAlign: TextAlign.right, style: const TextStyle(color: ChatColors.textMuted, fontSize: 12)),
          ],
          const SizedBox(height: 8),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 6,
            children: [
              if (place.ratingLabel != null) _infoChip(place.ratingLabel!, color: ChatColors.gold),
              if (place.priceLevelLabel != null) _infoChip(place.priceLevelLabel!),
              if (place.distanceMeters != null) _infoChip(place.distanceLabel),
              if (place.isOpenNow != null)
                _infoChip(place.isOpenNow! ? 'مفتوح الآن' : 'مغلق الآن',
                    color: place.isOpenNow! ? ChatColors.accentBright : Colors.redAccent),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0x0FFFFFFF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text('ليش رشّحته؟ $_reasonAr',
                textAlign: TextAlign.right, style: const TextStyle(color: ChatColors.textPrimary, fontSize: 12.5)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _openDirections,
                  icon: const Icon(Icons.directions, size: 16),
                  label: const Text('الاتجاهات', style: TextStyle(fontSize: 12.5)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: ChatColors.textPrimary,
                    side: const BorderSide(color: ChatColors.borderMedium),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: onOrder,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ChatColors.accent,
                    foregroundColor: const Color(0xFF04140A),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('اطلبه', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoChip(String text, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0x0FFFFFFF),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(text, style: TextStyle(color: color ?? ChatColors.textPrimary, fontSize: 11.5)),
    );
  }
}
