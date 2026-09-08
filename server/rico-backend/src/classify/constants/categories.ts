// Multi-intent LLM classifier constants — ported from server/groq-proxy.
// CATEGORIES intentionally excludes 'clothing_store': that slug was a
// porting bug introduced in the old rico-backend Express port (present
// neither in the live groq-proxy Worker nor in Flutter's local category
// enum), so any category the model returns is guaranteed to resolve on the
// client instead of being silently dropped.

export const CATEGORIES = [
  'restaurant',
  'cafe',
  'pharmacy',
  'supermarket',
  'fuel',
  'mall',
  'atm',
  'bank',
  'hospital',
  'clinic',
  'fitness_centre',
  'hotel',
  'clothes',
  'mobile_phone',
  'electronics',
  'hairdresser',
  'beauty',
  'car_wash',
  'dentist',
  'mosque',
  'park',
  'bakery',
  'sweets',
  'bookstore',
  'toy_store',
  'pet_store',
  'jewelry_store',
  'furniture_store',
  'shoe_store',
  'gift_shop',
  'florist',
  'laundry',
  'veterinary',
  'car_repair',
  'car_dealer',
  'car_rental',
  'parking',
  'lawyer',
  'real_estate',
  'travel_agency',
  'insurance',
] as const;

export const OTHER_TAG_KEYS = ['amenity', 'shop', 'leisure', 'tourism', 'office', 'craft'] as const;
export const RANKS = ['nearest', 'cheapest', 'open_now', 'best_rated'] as const;
export const MAX_INTENTS = 3;
