import 'package:flutter/material.dart';

/// نظام الألوان الموحّد للتطبيق — مصدر واحد لكل الألوان المستخدمة بدلاً من
/// تكرارها كقيم Hex متفرقة في كل ملف.
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF0F9D58);
  static const Color background = Color(0xFFF7F8FA);
  static const Color surfaceMuted = Color(0xFFF3F4F6);
  static const Color border = Color(0xFFE6E6E6);
  static const Color link = Color(0xFF1A73E8);
  static const Color userBubble = Color(0xFFEDEDED);
}

/// أنصاف أقطار الحواف الموحّدة.
class AppRadii {
  AppRadii._();

  static const double bubble = 18;
  static const double card = 14;
  static const double pill = 20;
  static const double input = 24;
}

/// ألوان شاشة المحادثة الداكنة فقط (مطابقة لتصميم RICO GO) — مستخدمة حصراً
/// في chat_screen.dart والودجتس التابعة لها؛ باقي الشاشات تبقى على الثيم
/// الفاتح في [AppColors].
class ChatColors {
  ChatColors._();

  static const Color background = Color(0xFF0A0F18);
  static const Color card = Color(0xFF0F1826);
  static const Color botBubble = Color(0xFF141D2A);
  static const Color composer = Color(0xFF121A26);

  static const Color accent = Color(0xFF22C55E); // --acc
  static const Color accentBright = Color(0xFF2EE57C); // --accB
  static const Color accentDark = Color(0xFF1C8F4E); // --accD (user bubble bg)
  static const Color gold = Color(0xFFC9A24A);

  static const Color textPrimary = Color(0xFFE6E9EF);
  static const Color textMuted = Color(0xFF8A93A5);
  static const Color textFaint = Color(0xFF5C6678);
  static const Color hintText = Color(0xFF6C7688);

  static const Color borderSubtle = Color(0x12FFFFFF); // rgba(255,255,255,0.07)
  static const Color borderMedium = Color(0x1EFFFFFF); // rgba(255,255,255,0.12)
}

class AppTheme {
  AppTheme._();

  static ThemeData light() {
    return ThemeData(
      primaryColor: AppColors.primary,
      fontFamily: 'Tajawal',
      scaffoldBackgroundColor: AppColors.background,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.primary,
        elevation: 0,
      ),
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        surface: Colors.white,
      ),
    );
  }
}
