import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// عنصر "اسحب للتأكيد" مخصص — Flutter لا يوفر ودجت جاهزة لهذا. الشاشة الأب
/// مغلّفة بـ Directionality.rtl، لذا نلفّ محتوى هذا العنصر بـ Directionality.ltr
/// صراحة حتى لا تتداخل دلالات RTL (المحاذاة، ترتيب أبناء Row) مع حساباتنا —
/// نستخدم Positioned(left:) المباشر (غير مرتبط بالاتجاه أصلاً) ونحسب موضع
/// المقبض يدوياً: يبدأ من اليمين (غير مؤكَّد) وينزلق لليسار عند التأكيد،
/// مطابقةً لسهم السحب في التصميم الأصلي.
class SlideToConfirm extends StatefulWidget {
  final String label;
  final VoidCallback onConfirmed;

  /// إذا كان true (الطلب مؤكَّد فعلاً من خارج هذا الودجت)، يبقى المقبض
  /// مقفلاً في نهاية المسار ولا يستجيب للسحب.
  final bool completed;

  const SlideToConfirm({
    super.key,
    required this.label,
    required this.onConfirmed,
    this.completed = false,
  });

  @override
  State<SlideToConfirm> createState() => _SlideToConfirmState();
}

class _SlideToConfirmState extends State<SlideToConfirm>
    with SingleTickerProviderStateMixin {
  static const double _thumbSize = 46;
  static const double _trackPadding = 6;
  static const double _confirmThreshold = 0.85;

  late final AnimationController _controller;
  bool _fired = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
      value: widget.completed ? 1 : 0,
    );
    _fired = widget.completed;
  }

  @override
  void didUpdateWidget(covariant SlideToConfirm oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.completed && !oldWidget.completed) {
      _fired = true;
      _controller.animateTo(1);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDragUpdate(DragUpdateDetails details, double maxTravel) {
    if (_fired || maxTravel <= 0) return;
    // السحب لليسار (dx سالب) يزيد نسبة التأكيد.
    final delta = -details.delta.dx / maxTravel;
    _controller.value = (_controller.value + delta).clamp(0.0, 1.0);
  }

  void _onDragEnd(DragEndDetails details) {
    if (_fired) return;
    if (_controller.value >= _confirmThreshold) {
      setState(() => _fired = true);
      _controller.animateTo(1).then((_) => widget.onConfirmed());
    } else {
      _controller.animateTo(0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final maxTravel = (constraints.maxWidth - _thumbSize - _trackPadding * 2)
              .clamp(0.0, double.infinity);

          return AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              // يبدأ المقبض من أقصى اليمين (0) وينزلق نحو اليسار مع التأكيد (1).
              final thumbLeft = _trackPadding + (1 - _controller.value) * maxTravel;
              final locked = _fired || widget.completed;

              return Container(
                height: _thumbSize + _trackPadding * 2,
                decoration: BoxDecoration(
                  color: ChatColors.card,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: ChatColors.accentBright.withValues(alpha: 0.3),
                  ),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Center(
                      child: Text(
                        widget.label,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: ChatColors.accentBright.withValues(alpha: 0.85),
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Positioned(
                      left: thumbLeft,
                      top: _trackPadding,
                      child: GestureDetector(
                        onHorizontalDragUpdate: (d) => _onDragUpdate(d, maxTravel),
                        onHorizontalDragEnd: _onDragEnd,
                        child: Container(
                          width: _thumbSize,
                          height: _thumbSize,
                          decoration: BoxDecoration(
                            color: ChatColors.accent,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: ChatColors.accent.withValues(alpha: 0.35),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Icon(
                            locked ? Icons.check : Icons.arrow_back,
                            color: const Color(0xFF04140A),
                            size: 20,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
