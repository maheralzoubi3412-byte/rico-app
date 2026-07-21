import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import '../theme/app_theme.dart';
import '../widgets/chat_pill_chip.dart';
import 'demo_order.dart';

/// بطاقة التتبّع الحي التجريبية (المرحلة الرابعة) — عرض تجريبي دائم، لا يتصل
/// بأي نظام توصيل حقيقي. انظر demo_order.dart.
class DemoTrackingCard extends StatelessWidget {
  final DemoOrder order;

  const DemoTrackingCard({super.key, required this.order});

  static const _steps = ['تأكيد', 'تحضير', 'استلام', 'توصيل'];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: ChatColors.accent.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: ChatColors.accentBright.withValues(alpha: 0.35)),
          ),
          child: Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: const BoxDecoration(color: ChatColors.accent, shape: BoxShape.circle),
                child: const Icon(Icons.check, size: 14, color: Color(0xFF04140A)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: RichText(
                  textAlign: TextAlign.right,
                  text: TextSpan(
                    style: const TextStyle(fontSize: 13.5, color: Color(0xFFEAFBF0)),
                    children: [
                      const TextSpan(text: 'تم الطلب والدفع ✓ رقم الطلب '),
                      TextSpan(
                        text: '#${order.orderNumber}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
              const _DemoBadge(),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: ChatColors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: ChatColors.borderMedium),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 120,
                child: CustomPaint(painter: _MiniMapPainter(step: order.deliveryStep)),
              ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${order.etaMinutes}',
                                style: const TextStyle(
                                    color: ChatColors.accentBright, fontWeight: FontWeight.bold, fontSize: 18)),
                            const Text('دقيقة متبقية',
                                style: TextStyle(color: ChatColors.textMuted, fontSize: 10.5)),
                          ],
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('${order.driverName} في الطريق إليك',
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(
                                      color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                              Text('${order.placeName} → موقعك',
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(color: ChatColors.textMuted, fontSize: 11.5)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        for (var i = 0; i < _steps.length; i++) ...[
                          if (i > 0) const SizedBox(width: 4),
                          Expanded(
                            child: Container(
                              height: 5,
                              decoration: BoxDecoration(
                                color: i <= order.deliveryStep
                                    ? ChatColors.accent
                                    : const Color(0xFF1E2A3A),
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        for (var i = 0; i < _steps.length; i++)
                          Text(
                            _steps[i],
                            style: TextStyle(
                              fontSize: 10.5,
                              color: i == order.deliveryStep ? ChatColors.accentBright : ChatColors.textFaint,
                              fontWeight: i == order.deliveryStep ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: ChatColors.botBubble,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: ChatColors.borderSubtle),
          ),
          child: Text(
            order.proactiveNoteAr,
            textAlign: TextAlign.right,
            style: const TextStyle(color: ChatColors.textPrimary, fontSize: 13.5, height: 1.5),
          ),
        ),
        const SizedBox(height: 10),
        Builder(
          builder: (context) => Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [
              ChatPillChip(label: 'اتصل بالسائق', onTap: () => _showDemoNotice(context)),
              ChatPillChip(label: 'شارك التتبّع', onTap: () => _shareTracking(order)),
              ChatPillChip(
                label: 'كرّر الطلب أسبوعيًا',
                onTap: () => _showDemoNotice(context),
                textColor: ChatColors.gold,
                borderColor: ChatColors.gold.withValues(alpha: 0.3),
                backgroundColor: ChatColors.gold.withValues(alpha: 0.1),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showDemoNotice(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('هذي ميزة ضمن العرض التجريبي فقط 🙂')),
    );
  }

  Future<void> _shareTracking(DemoOrder order) async {
    await Share.share(
      'أتابع طلبي #${order.orderNumber} من ${order.placeName} 🛵\n'
      '${order.driverName} في الطريق، الوصول خلال ${order.etaMinutes} دقيقة تقريبًا.',
    );
  }
}

class _MiniMapPainter extends CustomPainter {
  final int step;

  _MiniMapPainter({required this.step});

  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF101823), Color(0xFF0D1520)],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, bg);

    final roadPaint = Paint()
      ..color = const Color(0xFF1E2A3A)
      ..strokeWidth = 12
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path()
      ..moveTo(0, size.height * 0.3)
      ..lineTo(size.width * 0.35, size.height * 0.3)
      ..lineTo(size.width * 0.35, size.height * 0.75)
      ..lineTo(size.width, size.height * 0.75);
    canvas.drawPath(path, roadPaint);

    final routePaint = Paint()
      ..color = ChatColors.accentBright
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final dashedRoute = Path()
      ..moveTo(size.width * 0.06, size.height * 0.3)
      ..lineTo(size.width * 0.35, size.height * 0.3)
      ..lineTo(size.width * 0.35, size.height * 0.75)
      ..lineTo(size.width * 0.58, size.height * 0.75);
    canvas.drawPath(dashedRoute, routePaint);

    // منزل (وجهة التوصيل)
    final homeCenter = Offset(size.width * 0.94, size.height * 0.3);
    canvas.drawCircle(homeCenter, 12, Paint()..color = const Color(0xFF0F1826));
    canvas.drawCircle(
      homeCenter,
      12,
      Paint()
        ..color = ChatColors.gold
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    // السائق (متحرك حسب مرحلة التوصيل)
    final driverX = size.width * (0.06 + 0.5 * (step / 3).clamp(0.0, 1.0));
    final driverCenter = Offset(driverX, size.height * 0.75);
    canvas.drawCircle(
      driverCenter,
      13,
      Paint()..color = ChatColors.accent.withValues(alpha: 0.25),
    );
    canvas.drawCircle(driverCenter, 9, Paint()..color = ChatColors.accent);
  }

  @override
  bool shouldRepaint(covariant _MiniMapPainter oldDelegate) => oldDelegate.step != step;
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
