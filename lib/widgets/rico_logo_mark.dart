import 'package:flutter/material.dart';

/// شعار "ريكو" (حرف R بخط منسدل مع نقطة ذهبية) — نفس المسار المتجهي
/// المستخدم في تصميم RICO GO الأصلي (رمز #rmark، viewBox 0 0 200 240).
class RicoLogoMark extends StatelessWidget {
  final double height;
  final Color color;
  final Color dotColor;

  const RicoLogoMark({
    super.key,
    this.height = 20,
    this.color = Colors.white,
    this.dotColor = const Color(0xFFC9A24A),
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(height * (200 / 240), height),
      painter: _RicoLogoPainter(color: color, dotColor: dotColor),
    );
  }
}

class _RicoLogoPainter extends CustomPainter {
  final Color color;
  final Color dotColor;

  _RicoLogoPainter({required this.color, required this.dotColor});

  @override
  void paint(Canvas canvas, Size size) {
    // إحداثيات المسار الأصلي بمقاس viewBox="0 0 200 240".
    const viewW = 200.0;
    const viewH = 240.0;
    canvas.save();
    canvas.scale(size.width / viewW, size.height / viewH);

    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 30
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(
      Path()
        ..moveTo(47, 36)
        ..lineTo(47, 206),
      strokePaint,
    );

    canvas.drawPath(
      Path()
        ..moveTo(47, 44)
        ..cubicTo(104, 20, 160, 46, 160, 92)
        ..cubicTo(160, 130, 122, 140, 86, 121),
      strokePaint,
    );

    canvas.drawPath(
      Path()
        ..moveTo(96, 120)
        ..lineTo(154, 200),
      strokePaint,
    );

    canvas.drawCircle(const Offset(176, 192), 16, Paint()..color = dotColor);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _RicoLogoPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.dotColor != dotColor;
}
