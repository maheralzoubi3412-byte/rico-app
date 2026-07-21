import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// حبة اقتراح/إجراء سريع قابلة للنقر داخل فقاعات الدردشة — مطابقة لتصميم
/// الحبوب الشفافة في RICO GO (مثل "أبغى أرخص"، "اتصل بالسائق").
class ChatPillChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final Color? textColor;
  final Color? borderColor;
  final Color? backgroundColor;

  const ChatPillChip({
    super.key,
    required this.label,
    required this.onTap,
    this.textColor,
    this.borderColor,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: backgroundColor ?? const Color(0x0DFFFFFF),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: borderColor ?? ChatColors.borderMedium),
        ),
        child: Text(label, style: TextStyle(color: textColor ?? ChatColors.textPrimary, fontSize: 13)),
      ),
    );
  }
}
