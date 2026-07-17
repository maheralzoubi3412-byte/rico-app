// Enriches places with real price_level/rating from the Google Places API
// (New). This is the only adapter that costs money per call — keep the
// FieldMask minimal (only fields our schema actually stores) to avoid paying
// for Pro-tier fields we don't use.

const GOOGLE_TYPE_BY_CATEGORY = {
  restaurant: ['restaurant'],
  cafe: ['cafe'],
  pharmacy: ['pharmacy'],
  supermarket: ['supermarket', 'grocery_store'],
  fuel: ['gas_station'],
  mall: ['shopping_mall'],
  atm: ['atm'],
  bank: ['bank'],
  hospital: ['hospital'],
  clinic: ['doctor'],
  fitness_centre: ['gym'],
};

const FIELD_MASK = 'places.id,places.displayName,places.location,places.priceLevel,places.rating,places.userRatingCount';

// Google's enum -> our normalized 1-4 integer scale (see schema.sql price_level).
const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function searchNearby(env, { lat, lng, radiusMeters, categorySlug }) {
  const includedTypes = GOOGLE_TYPE_BY_CATEGORY[categorySlug];
  if (!includedTypes) {
    throw new Error(`no_google_type_for_category:${categorySlug}`);
  }
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw new Error('google_places_not_configured');
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`google_places_error:${response.status}:${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const places = data.places || [];

  return places.map((p) => ({
    sourceId: p.id,
    name: p.displayName && p.displayName.text ? p.displayName.text : 'Unknown',
    categorySlug,
    lat: p.location.latitude,
    lng: p.location.longitude,
    priceLevel: PRICE_LEVEL_MAP[p.priceLevel] || null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    ratingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    enrichmentSource: 'google',
  }));
}

export { searchNearby, GOOGLE_TYPE_BY_CATEGORY };
