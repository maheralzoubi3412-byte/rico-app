import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'rico_surfaces.dart';

/// شاشة البداية داخل المحادثة — تُعرض بدل قائمة الرسائل حين تكون المحادثة
/// فارغة تماماً، بدل فقاعة ترحيب نصية طويلة. تعطي الهوية مساحة تتنفّس فيها،
/// وتقدّم أمثلة قابلة للنقر تعلّم المستخدم كيف يخاطب ريكو فعلياً.
class WelcomeHero extends StatelessWidget {
  /// يُستدعى بنص الاقتراح كما لو كتبه المستخدم بنفسه — لا فلترة وهمية.
  final void Function(String prompt) onPickSuggestion;

  const WelcomeHero({super.key, required this.onPickSuggestion});

  static const List<({IconData icon, String title, String prompt})> _suggestions = [
    (icon: Icons.restaurant_rounded, title: 'أقرب مطعم', prompt: 'أقرب مطعم'),
    (icon: Icons.local_cafe_rounded, title: 'أرخص كافيه', prompt: 'أرخص كافيه'),
    (icon: Icons.local_offer_rounded, title: 'عروض قريبة', prompt: 'وش العروض القريبة؟'),
    (icon: Icons.local_pharmacy_rounded, title: 'صيدلية فاتحة', prompt: 'أقرب صيدلية مفتوحة الحين'),
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
      child: Column(
        children: [
          const RicoAvatar(size: 68),
          const SizedBox(height: 18),
          Text('ريكو', style: RicoText.display.copyWith(fontSize: 27)),
          const SizedBox(height: 6),
          Text(
            'مساعدك الذكي يدلّك على أقرب مكان\nوأفضل عرض حسب موقعك',
            textAlign: TextAlign.center,
            style: RicoText.body.copyWith(color: RicoColors.inkMuted),
          ),
          const SizedBox(height: 22),
          const _GoldRule(),
          const SizedBox(height: 22),
          const Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('جرّب تسألني', style: RicoText.labelStrong),
          ),
          const SizedBox(height: 10),
          // شبكة ٢×٢ بنسبة عرض ثابتة — مقاس متوقّع على كل الشاشات بلا قفزات.
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 2.35,
            children: [
              for (final s in _suggestions)
                _SuggestionTile(
                  icon: s.icon,
                  title: s.title,
                  onTap: () => onPickSuggestion(s.prompt),
                ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.my_location_rounded, size: 13, color: RicoColors.inkFaint),
              const SizedBox(width: 6),
              Text('نرتّب النتائج حسب موقعك الحالي', style: RicoText.caption.copyWith(color: RicoColors.inkFaint)),
            ],
          ),
        ],
      ),
    );
  }
}

/// فاصل زخرفي — خطان متلاشيان بلون ذهبي حول معيّن صغير. اللمسة الذهبية هي
/// ما يفصل الإحساس "المؤسسي السعودي" عن الأخضر الوظيفي وحده.
class _GoldRule extends StatelessWidget {
  const _GoldRule();

  @override
  Widget build(BuildContext context) {
    const fade = LinearGradient(
      colors: [Colors.transparent, RicoColors.gold, Colors.transparent],
    );
    return SizedBox(
      width: 180,
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 1,
              decoration: const BoxDecoration(gradient: fade),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Transform.rotate(
              angle: 0.785398, // 45°
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: RicoColors.gold,
                  borderRadius: BorderRadius.circular(1),
                ),
              ),
            ),
          ),
          Expanded(
            child: Container(
              height: 1,
              decoration: const BoxDecoration(gradient: fade),
            ),
          ),
        ],
      ),
    );
  }
}

class _SuggestionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _SuggestionTile({required this.icon, required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return RicoCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      shadow: RicoShadows.subtle,
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: RicoColors.primaryTint,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 17, color: RicoColors.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: RicoText.label.copyWith(fontWeight: FontWeight.w600, color: RicoColors.ink),
              maxLines: 2,
            ),
          ),
        ],
      ),
    );
  }
}
