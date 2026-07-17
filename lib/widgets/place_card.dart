import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/place_result.dart';
import '../services/favorites_service.dart';
import '../theme/app_theme.dart';

class PlaceCard extends StatefulWidget {
  final PlaceResult place;
  final int rank;

  const PlaceCard({super.key, required this.place, required this.rank});

  @override
  State<PlaceCard> createState() => _PlaceCardState();
}

class _PlaceCardState extends State<PlaceCard> {
  final FavoritesService _favoritesService = FavoritesService();
  bool _isFavorite = false;

  @override
  void initState() {
    super.initState();
    _favoritesService.isFavorite(widget.place.osmId).then((value) {
      if (mounted) setState(() => _isFavorite = value);
    });
  }

  Future<void> _toggleFavorite() async {
    final newState = await _favoritesService.toggle(widget.place);
    if (mounted) setState(() => _isFavorite = newState);
  }

  Future<void> _openDirections() async {
    final uri = Uri.parse(widget.place.directionsUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _callPhone(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _share() async {
    await Share.share('${widget.place.name}\n${widget.place.directionsUrl}');
  }

  @override
  Widget build(BuildContext context) {
    final place = widget.place;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: AppColors.primary.withValues(alpha: 0.12),
            child: Text('${widget.rank}',
                style: const TextStyle(
                    color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(place.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15)),
                    ),
                    InkWell(
                      onTap: _toggleFavorite,
                      borderRadius: BorderRadius.circular(20),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Icon(
                          _isFavorite ? Icons.bookmark : Icons.bookmark_border,
                          size: 20,
                          color: _isFavorite
                              ? AppColors.primary
                              : Colors.grey[400],
                        ),
                      ),
                    ),
                  ],
                ),
                if (place.address.isNotEmpty)
                  Text(place.address,
                      style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    if (place.distanceMeters != null)
                      _chip(Icons.location_on, place.distanceLabel),
                    if (place.ratingLabel != null)
                      _chip(Icons.star, place.ratingLabel!, color: Colors.amber[700]),
                    if (place.priceLevelLabel != null)
                      _chip(Icons.payments, place.priceLevelLabel!),
                    if (place.isOpenNow != null)
                      _chip(
                        Icons.circle,
                        place.isOpenNow! ? 'مفتوح الآن' : 'مغلق الآن',
                        color: place.isOpenNow! ? Colors.green : Colors.red,
                      ),
                    if (place.openingHours != null)
                      _chip(Icons.access_time, place.openingHours!),
                    if (place.phone != null)
                      _chip(Icons.phone, place.phone!,
                          onTap: () => _callPhone(place.phone!)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _openDirections,
                        icon: const Icon(Icons.directions, size: 16),
                        label: const Text('الاتجاهات', style: TextStyle(fontSize: 12.5)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.link,
                          side: const BorderSide(color: AppColors.link),
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          minimumSize: const Size(0, 36),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: _share,
                      borderRadius: BorderRadius.circular(20),
                      child: const Padding(
                        padding: EdgeInsets.all(6),
                        child: Icon(Icons.share, size: 18, color: Colors.grey),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(IconData icon, String text, {VoidCallback? onTap, Color? color}) {
    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color ?? Colors.grey[700]),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 11, color: color)),
        ],
      ),
    );

    if (onTap == null) return chip;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.pill),
      child: chip,
    );
  }
}
