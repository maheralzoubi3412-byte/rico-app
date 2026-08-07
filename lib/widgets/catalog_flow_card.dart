import 'package:flutter/material.dart';
import '../models/request_flow.dart';
import '../theme/app_theme.dart';

/// بطاقة تصفّح منتجات/عروض نشاط تجاري حقيقي ثم تأكيد طلب تواصل — تعرض
/// [RequestFlow] بمراحله الثلاث (تصفّح، تأكيد/إرسال، تم الإرسال).
class CatalogFlowCard extends StatefulWidget {
  final RequestFlow flow;
  final void Function(String itemType, String itemId, String label, String? detail)? onSelectItem;
  final void Function(String name, String phone)? onConfirm;
  final VoidCallback? onCancel;

  const CatalogFlowCard({
    super.key,
    required this.flow,
    this.onSelectItem,
    this.onConfirm,
    this.onCancel,
  });

  @override
  State<CatalogFlowCard> createState() => _CatalogFlowCardState();
}

class _CatalogFlowCardState extends State<CatalogFlowCard> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final flow = widget.flow;
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ChatColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ChatColors.borderSubtle),
      ),
      child: switch (flow.stage) {
        RequestFlowStage.browsing => _buildBrowsing(flow),
        RequestFlowStage.confirming || RequestFlowStage.submitting => _buildConfirming(flow),
        RequestFlowStage.submitted => _buildSubmitted(flow),
      },
    );
  }

  Widget _buildBrowsing(RequestFlow flow) {
    final catalog = flow.catalog;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (catalog.deals.isNotEmpty) ...[
          _sectionLabel('العروض'),
          for (final deal in catalog.deals)
            _ItemRow(
              title: deal.titleAr,
              subtitle: deal.typeLabel,
              icon: Icons.local_offer,
              iconColor: ChatColors.gold,
              onTap: () => widget.onSelectItem?.call('deal', deal.id, deal.titleAr, deal.typeLabel),
            ),
          if (catalog.products.isNotEmpty) const SizedBox(height: 10),
        ],
        if (catalog.products.isNotEmpty) ...[
          _sectionLabel('المنتجات'),
          for (final product in catalog.products)
            _ItemRow(
              title: product.name,
              subtitle: product.hasDiscount
                  ? '${product.finalPrice.toStringAsFixed(0)} ر.س (كان ${product.price.toStringAsFixed(0)} ر.س)'
                  : '${product.finalPrice.toStringAsFixed(0)} ر.س',
              icon: Icons.shopping_bag_outlined,
              iconColor: ChatColors.accentBright,
              onTap: () => widget.onSelectItem?.call(
                'product',
                product.id,
                product.name,
                '${product.finalPrice.toStringAsFixed(0)} ر.س',
              ),
            ),
        ],
      ],
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            textAlign: TextAlign.right,
            style: const TextStyle(color: ChatColors.textMuted, fontSize: 11.5, fontWeight: FontWeight.bold)),
      );

  Widget _buildConfirming(RequestFlow flow) {
    final submitting = flow.stage == RequestFlowStage.submitting;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0x0FFFFFFF),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(flow.selectedItemLabel ?? '',
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              if (flow.selectedItemDetail != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(flow.selectedItemDetail!,
                      textAlign: TextAlign.right, style: const TextStyle(color: ChatColors.textMuted, fontSize: 12)),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _nameController,
          textAlign: TextAlign.right,
          enabled: !submitting,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: _inputDecoration('الاسم'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _phoneController,
          textAlign: TextAlign.right,
          enabled: !submitting,
          keyboardType: TextInputType.phone,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: _inputDecoration('رقم الجوال'),
        ),
        if (flow.errorMessage != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(flow.errorMessage!,
                textAlign: TextAlign.right, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
          ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: submitting ? null : widget.onCancel,
                style: OutlinedButton.styleFrom(
                  foregroundColor: ChatColors.textPrimary,
                  side: const BorderSide(color: ChatColors.borderMedium),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                child: const Text('رجوع', style: TextStyle(fontSize: 12.5)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton(
                onPressed: submitting
                    ? null
                    : () {
                        final name = _nameController.text.trim();
                        final phone = _phoneController.text.trim();
                        if (name.isEmpty || phone.isEmpty) return;
                        widget.onConfirm?.call(name, phone);
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: ChatColors.accent,
                  foregroundColor: const Color(0xFF04140A),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF04140A)),
                      )
                    : const Text('تأكيد الطلب', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: ChatColors.textMuted, fontSize: 12.5),
      filled: true,
      fillColor: const Color(0x0FFFFFFF),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
    );
  }

  Widget _buildSubmitted(RequestFlow flow) {
    return Row(
      children: [
        const Icon(Icons.check_circle, color: ChatColors.accentBright, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            'تم إرسال طلبك ✅ بيتواصل معك ${flow.catalog.businessName} قريباً على ${flow.customerPhone ?? ""}.',
            textAlign: TextAlign.right,
            style: const TextStyle(color: ChatColors.textPrimary, fontSize: 13),
          ),
        ),
      ],
    );
  }
}

class _ItemRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final VoidCallback onTap;

  const _ItemRow({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: const Color(0x0AFFFFFF),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.chevron_left, size: 16, color: ChatColors.textMuted),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(title,
                      textAlign: TextAlign.right,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13.5)),
                  const SizedBox(height: 2),
                  Text(subtitle, textAlign: TextAlign.right, style: TextStyle(color: iconColor, fontSize: 11.5)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: iconColor.withValues(alpha: 0.14), shape: BoxShape.circle),
              child: Icon(icon, size: 14, color: iconColor),
            ),
          ],
        ),
      ),
    );
  }
}
