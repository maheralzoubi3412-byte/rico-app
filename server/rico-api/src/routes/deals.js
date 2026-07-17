import { activeDealsNear } from '../db/repository.js';
import { jsonResponse } from '../lib/http.js';

async function handleDeals(request, env) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const radiusMeters = url.searchParams.has('radius')
    ? Number(url.searchParams.get('radius'))
    : 3000;
  const now = url.searchParams.has('now') ? Number(url.searchParams.get('now')) : Date.now();

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return jsonResponse({ error: 'invalid_lat' }, 400);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return jsonResponse({ error: 'invalid_lng' }, 400);
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) {
    return jsonResponse({ error: 'invalid_radius' }, 400);
  }

  const deals = await activeDealsNear(env, { lat, lng, radiusMeters, now });

  return jsonResponse({
    deals: deals.map((d) => ({
      id: d.id,
      placeId: d.place_id,
      placeName: d.place_name,
      titleAr: d.title_ar,
      descriptionAr: d.description_ar,
      dealType: d.deal_type,
      value: d.value,
      currency: d.currency,
      promoCode: d.promo_code,
      distanceMeters: d.distanceMeters,
      source: d.source,
      sourceRef: d.source_ref,
    })),
  });
}

export { handleDeals };
