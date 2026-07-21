import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/rico_logo_mark.dart';
import 'demo_order.dart';
import 'slide_to_confirm.dart';

/// بطاقة ملخص الطلب التجريبية (مرحلة التأكيد والدفع) — عرض تجريبي دائم، غير
/// متصل بأي نظام دفع أو طلبات حقيقي. انظر demo_order.dart.
class DemoOrderCard extends StatelessWidget {
  final DemoOrder order;
  final VoidCallback onConfirmed;

  const DemoOrderCard({super.key, required this.order, required this.onConfirmed});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: ChatColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: ChatColors.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                const RicoLogoMark(height: 17, color: Colors.white),
                const SizedBox(width: 8),
                const _DemoBadge(),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'ملخص الطلب · ${order.placeName}',
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12),
            height: 1,
            color: ChatColors.borderSubtle,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final item in order.items) _itemRow(item),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border(
                        top: BorderSide(color: ChatColors.borderMedium),
                      ),
                    ),
                    child: SizedBox(height: 1),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          order.totalSar.toStringAsFixed(0),
                          style: const TextStyle(
                            color: ChatColors.accentBright,
                            fontWeight: FontWeight.bold,
                            fontSize: 20,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Text('ر.س', style: TextStyle(color: ChatColors.accentBright, fontSize: 12)),
                      ],
                    ),
                    const Text('الإجمالي',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(order.savingsNoteAr,
                    textAlign: TextAlign.right,
                    style: const TextStyle(color: ChatColors.gold, fontSize: 12)),
                const SizedBox(height: 12),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0x08FFFFFF),
              border: Border(top: BorderSide(color: ChatColors.borderSubtle)),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('تغيير', style: TextStyle(color: ChatColors.accentBright, fontSize: 12.5)),
                Row(
                  children: [
                    Text('Apple Pay', style: TextStyle(color: ChatColors.textPrimary, fontSize: 13)),
                    SizedBox(width: 8),
                    Icon(Icons.apple, color: Colors.white, size: 18),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                SlideToConfirm(
                  label: 'اسحب لتأكيد الطلب والدفع',
                  onConfirmed: onConfirmed,
                ),
                const SizedBox(height: 10),
                const Text(
                  'لن يُخصم أي مبلغ قبل تأكيدك · يمكنك الإلغاء خلال دقيقتين',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ChatColors.textFaint, fontSize: 11.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _itemRow(DemoOrderItem item) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '${item.priceSar.toStringAsFixed(0)} ر.س',
            style: const TextStyle(color: ChatColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13.5),
          ),
          Flexible(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (item.addedByRico) ...[
                  Container(
                    margin: const EdgeInsets.only(left: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: ChatColors.accent.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text('أضافها ريكو',
                        style: TextStyle(color: ChatColors.accentBright, fontSize: 10.5)),
                  ),
                ],
                Flexible(
                  child: Text(
                    item.nameAr,
                    textAlign: TextAlign.right,
                    style: const TextStyle(color: ChatColors.textPrimary, fontSize: 13.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DemoBadge extends StatelessWidget {
  const _DemoBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: ChatColors.gold.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: ChatColors.gold.withValues(alpha: 0.4)),
      ),
      child: const Text('عرض تجريبي', style: TextStyle(color: ChatColors.gold, fontSize: 10.5)),
    );
  }
}
