import { placesNearby } from '../db/repository.js';
import { jsonResponse } from '../lib/http.js';

const VALID_RANKS = new Set(['nearest', 'cheapest', 'best_rated']);

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const radiusMeters = url.searchParams.has('radius')
    ? Number(url.searchParams.get('radius'))
    : 3000;
  const categorySlug = url.searchParams.get('categorySlug') || undefined;
  const rank = url.searchParams.get('rank') || 'nearest';
  const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 8;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return jsonResponse({ error: 'invalid_lat' }, 400);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return jsonResponse({ error: 'invalid_lng' }, 400);
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) {
    return jsonResponse({ error: 'invalid_radius' }, 400);
  }
  if (!VALID_RANKS.has(rank)) {
    return jsonResponse({ error: 'invalid_rank' }, 400);
  }

  const places = await placesNearby(env, { lat, lng, radiusMeters, categorySlug, rank, limit });

  // Never claim a ranking the data can't back up: if the caller asked for
  // cheapest/best_rated but nothing in range actually has that data, say so
  // explicitly so the client can fall back to an honest distance-based
  // message instead of presenting an unranked list as if it were ranked.
  const priceDataAvailable = rank !== 'cheapest' || places.some((p) => p.price_level != null);
  const ratingDataAvailable = rank !== 'best_rated' || places.some((p) => p.rating != null);

  return jsonResponse({
    priceDataAvailable,
    ratingDataAvailable,
    places: places.map((p) => ({
      id: p.id,
      name: p.name,
      nameAr: p.name_ar,
      categorySlug: p.category_slug,
      lat: p.lat,
      lng: p.lng,
      address: p.address,
      phone: p.phone,
      openingHours: p.opening_hours,
      priceLevel: p.price_level,
      rating: p.rating,
      ratingCount: p.rating_count,
      distanceMeters: p.distanceMeters,
    })),
  });
}

export { handleSearch };
