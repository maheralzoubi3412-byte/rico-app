import 'package:flutter/material.dart';
import '../services/intent_service.dart';
import '../theme/app_theme.dart';
import 'rico_surfaces.dart';

/// بطاقة "فهمت طلبك" — تعرض وسوماً مشتقة فعلياً من [QueryIntent] فقط (لا وسوم
/// وهمية مثل المناسبة أو عدد الأشخاص، لأن المصنّف لا يستخرج هذه البيانات).
/// وجودها يطمئن المستخدم أن طلبه فُهم كما قصده قبل وصول النتائج.
class UnderstandingCard extends StatelessWidget {
  final QueryIntent intent;

  const UnderstandingCard({super.key, required this.intent});

  static const Map<String, IconData> _categoryIcons = {
    'restaurant': Icons.restaurant_rounded,
    'cafe': Icons.local_cafe_rounded,
    'pharmacy': Icons.local_pharmacy_rounded,
    'supermarket': Icons.local_grocery_store_rounded,
    'fuel': Icons.local_gas_station_rounded,
    'mall': Icons.storefront_rounded,
    'atm': Icons.atm_rounded,
    'bank': Icons.account_balance_rounded,
    'hospital': Icons.local_hospital_rounded,
    'clinic': Icons.medical_services_rounded,
    'fitness_centre': Icons.fitness_center_rounded,
    'hotel': Icons.hotel_rounded,
    'clothes': Icons.checkroom_rounded,
    'mobile_phone': Icons.smartphone_rounded,
    'electronics': Icons.devices_other_rounded,
    'hairdresser': Icons.content_cut_rounded,
    'beauty': Icons.spa_rounded,
    'car_wash': Icons.local_car_wash_rounded,
    'dentist': Icons.medical_information_rounded,
    'mosque': Icons.mosque_rounded,
    'park': Icons.park_rounded,
  };

  IconData get _categoryIcon => intent.kind == IntentKind.deals
      ? Icons.local_offer_rounded
      : (_categoryIcons[intent.slug] ?? Icons.place_rounded);

  List<({IconData icon, String label})> get _tags {
    if (intent.kind == IntentKind.deals) {
      return [(icon: Icons.local_offer_rounded, label: 'العروض القريبة')];
    }

    final tags = <({IconData icon, String label})>[
      (icon: _categoryIcon, label: intent.label),
    ];

    switch (intent.rank) {
      case RankMode.cheapest:
        tags.add((icon: Icons.savings_rounded, label: 'الأرخص'));
      case RankMode.bestRated:
        tags.add((icon: Icons.star_rounded, label: 'الأعلى تقييماً'));
      case RankMode.openNow:
        tags.add((icon: Icons.schedule_rounded, label: 'مفتوح الحين'));
      case RankMode.nearest:
        tags.add((icon: Icons.near_me_rounded, label: 'الأقرب لك'));
    }

    if (intent.brandHint != null && intent.brandHint!.trim().isNotEmpty) {
      tags.add((icon: Icons.business_rounded, label: intent.brandHint!));
    }

    return tags;
  }

  @override
  Widget build(BuildContext context) {
    return RicoCard(
      padding: const EdgeInsets.all(13),
      shadow: RicoShadows.subtle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 20,
                height: 20,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: RicoColors.primary, shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded, size: 13, color: Colors.white),
              ),
              const SizedBox(width: 8),
              const Text('فهمت طلبك', style: RicoText.labelStrong),
            ],
          ),
          const SizedBox(height: 11),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final tag in _tags)
                MetaChip(icon: tag.icon, label: tag.label, tone: RicoColors.primaryDeep),
            ],
          ),
        ],
      ),
    );
  }
}
