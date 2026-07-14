import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/place_result.dart';

class PlaceCard extends StatelessWidget {
  final PlaceResult place;
  final int rank;

  const PlaceCard({super.key, required this.place, required this.rank});

  Future<void> _openInMaps() async {
    final uri = Uri.parse(place.googleMapsUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE6E6E6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
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
            backgroundColor: const Color(0xFF0F9D58).withOpacity(0.12),
            child: Text('$rank',
                style: const TextStyle(
                    color: Color(0xFF0F9D58), fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(place.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15)),
                const SizedBox(height: 4),
                if (place.address.isNotEmpty)
                  Text(place.address,
                      style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    if (place.distanceMeters != null)
                      _chip('📍 ${place.distanceLabel}'),
                    if (place.openingHours != null)
                      _chip('🕒 ${place.openingHours}'),
                    if (place.phone != null) _chip('📞 ${place.phone}'),
                  ],
                ),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: _openInMaps,
                  child: const Text(
                    'فتح في خرائط جوجل ↗',
                    style: TextStyle(
                        color: Color(0xFF1A73E8),
                        fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text, style: const TextStyle(fontSize: 11)),
    );
  }
}
