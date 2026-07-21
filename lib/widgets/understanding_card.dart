import 'package:flutter/material.dart';
import '../services/intent_service.dart';
import '../theme/app_theme.dart';

/// بطاقة "فهمت طلبك" — تعرض وسوماً مشتقة فعلياً من [QueryIntent] فقط (لا وسوم
/// وهمية مثل مناسبة/عدد أشخاص لأن المصنّف لا يستخرج هذه البيانات)، بالإضافة
/// إلى خطوة عمل حقيقية أثناء تنفيذ البحث الفعلي.
class UnderstandingCard extends StatelessWidget {
  final QueryIntent intent;

  const UnderstandingCard({super.key, required this.intent});

  static const Map<String, String> _categoryIcons = {
    'restaurant': '🍽️',
    'cafe': '☕',
    'pharmacy': '💊',
    'supermarket': '🛒',
    'fuel': '⛽',
    'mall': '🛍️',
    'atm': '🏧',
    'bank': '🏦',
    'hospital': '🏥',
    'clinic': '🩺',
    'fitness_centre': '🏋️',
  };

  String get _categoryIcon =>
      intent.kind == IntentKind.deals ? '🏷️' : (_categoryIcons[intent.slug] ?? '📍');

  List<({String icon, String label})> get _tags {
    if (intent.kind == IntentKind.deals) {
      return [(icon: '🏷️', label: 'العروض القريبة')];
    }

    final tags = <({String icon, String label})>[
      (icon: _categoryIcon, label: intent.label),
    ];

    switch (intent.rank) {
      case RankMode.cheapest:
        tags.add((icon: '💰', label: 'الأرخص'));
      case RankMode.bestRated:
        tags.add((icon: '⭐', label: 'الأعلى تقييماً'));
      case RankMode.openNow:
        tags.add((icon: '🕐', label: 'مفتوح الآن'));
      case RankMode.nearest:
        break;
    }

    if (intent.brandHint != null && intent.brandHint!.trim().isNotEmpty) {
      tags.add((icon: '🏢', label: intent.brandHint!));
    }

    return tags;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ChatColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ChatColors.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              const Text('فهمت طلبك',
                  style: TextStyle(color: ChatColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13.5)),
              const SizedBox(width: 8),
              Container(
                width: 20,
                height: 20,
                decoration: const BoxDecoration(color: ChatColors.accent, shape: BoxShape.circle),
                child: const Icon(Icons.check, size: 13, color: Color(0xFF04140A)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [for (final tag in _tags) _tagChip(tag.icon, tag.label)],
          ),
        ],
      ),
    );
  }

  Widget _tagChip(String icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0x0FFFFFFF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: ChatColors.borderMedium),
      ),
      child: Text('$icon $label', style: const TextStyle(color: ChatColors.textPrimary, fontSize: 12.5)),
    );
  }
}
