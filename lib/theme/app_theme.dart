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
