import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// بطاقة "ريكو يشتغل الآن…" — محاكاة بصرية لتقدّم البحث أثناء انتظار
/// النتيجة الفعلية. الرسالة كاملة تُستبدل بالنتائج الحقيقية فور وصولها، لذا
/// هذه البطاقة مؤقتة بحتة ولا تدّعي أرقاماً غير معروفة فعلياً (مثل عدد
/// الأماكن المفحوصة) — الخطوات نصوص عامة صحيحة دائماً.
class WorkingStepsCard extends StatefulWidget {
  final String searchLabel;

  const WorkingStepsCard({super.key, required this.searchLabel});

  @override
  State<WorkingStepsCard> createState() => _WorkingStepsCardState();
}

class _WorkingStepsCardState extends State<WorkingStepsCard> {
  static const _stepDelay = Duration(milliseconds: 900);
  int _step = 0;
  Timer? _timer;

  late final List<String> _steps = [
    'حدّدت موقعك',
    'يفحص ${widget.searchLabel} القريبة',
    'يقارن الأسعار والتقييمات',
    'يجهّز أفضل الخيارات',
  ];

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(_stepDelay, (timer) {
      if (!mounted) return;
      if (_step >= _steps.length - 1) {
        timer.cancel();
        return;
      }
      setState(() => _step++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ChatColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ChatColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('ريكو يشتغل الآن…',
                  style: TextStyle(color: ChatColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
              SizedBox(width: 8),
              _PulseDots(),
            ],
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < _steps.length; i++) _stepRow(i),
        ],
      ),
    );
  }

  Widget _stepRow(int i) {
    final done = i < _step;
    final active = i == _step;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Expanded(
            child: Text(
              _steps[i],
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 13,
                color: done ? ChatColors.textPrimary : (active ? Colors.white : ChatColors.textFaint),
                fontWeight: active ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          const SizedBox(width: 10),
          _stepIcon(done: done, active: active),
        ],
      ),
    );
  }

  Widget _stepIcon({required bool done, required bool active}) {
    if (done) {
      return Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(color: ChatColors.accent.withValues(alpha: 0.16), shape: BoxShape.circle),
        child: const Icon(Icons.check, size: 11, color: ChatColors.accentBright),
      );
    }
    if (active) {
      return const SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(strokeWidth: 2, color: ChatColors.accentBright),
      );
    }
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFF2A3444), width: 1.5),
      ),
    );
  }
}

/// نقاط نابضة (مطابقة لـ keyframes dotBlink في التصميم الأصلي: 0%/80%/100%
/// بشفافية 0.25 و40% بشفافية 1)، بفارق توقيت بين النقاط.
class _PulseDots extends StatefulWidget {
  const _PulseDots();

  @override
  State<_PulseDots> createState() => _PulseDotsState();
}

class _PulseDotsState extends State<_PulseDots> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double _opacityFor(double t, double phase) {
    final x = (t + phase) % 1.0;
    if (x < 0.4) return 0.25 + (x / 0.4) * 0.75;
    if (x < 0.8) return 1 - ((x - 0.4) / 0.4) * 0.75;
    return 0.25;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final phase in [0.0, 1 / 6, 1 / 3])
              Padding(
                padding: const EdgeInsets.only(left: 3),
                child: Opacity(
                  opacity: _opacityFor(_controller.value, phase),
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(color: ChatColors.accentBright, shape: BoxShape.circle),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
