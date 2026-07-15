import 'package:flutter/material.dart';
import '../models/place_result.dart';
import '../services/favorites_service.dart';
import '../theme/app_theme.dart';
import '../widgets/place_card.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final FavoritesService _favoritesService = FavoritesService();
  List<PlaceResult>? _favorites;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final favorites = await _favoritesService.getAll();
    if (mounted) setState(() => _favorites = favorites);
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('المفضّلة')),
        body: _favorites == null
            ? const Center(child: CircularProgressIndicator())
            : _favorites!.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.bookmark_border,
                              size: 48, color: Colors.grey[400]),
                          const SizedBox(height: 12),
                          Text(
                            'لا توجد أماكن محفوظة بعد.\nاضغط على أيقونة الحفظ 🔖 عند أي نتيجة لإضافتها هنا.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _favorites!.length,
                      itemBuilder: (context, index) => PlaceCard(
                        place: _favorites![index],
                        rank: index + 1,
                      ),
                    ),
                  ),
      ),
    );
  }
}
