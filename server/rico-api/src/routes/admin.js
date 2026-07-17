import { normalizePlace, normalizeDeal } from '../adapters/manual.js';
import { searchNearby, GOOGLE_TYPE_BY_CATEGORY } from '../adapters/google_places.js';
import {
  upsertPlace,
  linkSource,
  findPlaceBySource,
  upsertDeal,
  getApiUsage,
  incrementApiUsage,
  recentSync,
  recordSync,
  getPendingDeals,
  updateDealStatus,
} from '../db/repository.js';
import { geohashEncode } from '../lib/geo.js';
import { jsonResponse } from '../lib/http.js';

const GOOGLE_PLACES_PROVIDER = 'google_places';
const DEFAULT_MONTHLY_CAP = 200; // conservative — well under any plausible free-tier ceiling
const DEFAULT_COOLDOWN_DAYS = 30; // price/rating data doesn't change fast enough to justify more frequent re-syncs
const SYNC_DEDUP_GEOHASH_PRECISION = 4; // ~20-40km cell — cooldown is neighborhood/city-grained, not exact-point

function isAuthorized(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

async function handleAdminPlaces(request, env) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const normalized = normalizePlace(body);
  if (normalized.error) {
    return jsonResponse({ error: normalized.error }, 400);
  }

  // Idempotent by sourceId: re-seeding the same manual place updates it in
  // place instead of creating a duplicate row.
  const existing = await findPlaceBySource(env, 'manual', normalized.sourceId);
  const place = existing ? { ...normalized.place, id: existing.id } : normalized.place;

  const placeId = await upsertPlace(env, place);
  await linkSource(env, { source: 'manual', sourceId: normalized.sourceId, placeId });

  return jsonResponse({ placeId }, existing ? 200 : 201);
}

async function handleAdminDeals(request, env) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const normalized = normalizeDeal(body);
  if (normalized.error) {
    return jsonResponse({ error: normalized.error }, 400);
  }

  const dealId = await upsertDeal(env, normalized.deal);
  return jsonResponse({ dealId }, 201);
}

// Syncs real price_level/rating from Google Places into `places`, keyed by
// (source='google', sourceId=<Google place id>) so re-running is idempotent
// and never collides with manually-entered or future OSM-sourced rows.
async function handleAdminSyncGoogle(request, env) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const radiusMeters = body?.radiusMeters !== undefined ? Number(body.radiusMeters) : 2000;
  const categorySlug = body?.categorySlug;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return jsonResponse({ error: 'invalid_lat' }, 400);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return jsonResponse({ error: 'invalid_lng' }, 400);
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) {
    return jsonResponse({ error: 'invalid_radius' }, 400);
  }
  if (!GOOGLE_TYPE_BY_CATEGORY[categorySlug]) {
    return jsonResponse({ error: 'invalid_category_slug' }, 400);
  }

  const monthlyCap = env.GOOGLE_PLACES_MONTHLY_CAP
    ? Number(env.GOOGLE_PLACES_MONTHLY_CAP)
    : DEFAULT_MONTHLY_CAP;
  const cooldownDays = env.GOOGLE_SYNC_COOLDOWN_DAYS
    ? Number(env.GOOGLE_SYNC_COOLDOWN_DAYS)
    : DEFAULT_COOLDOWN_DAYS;
  const force = body?.force === true;

  const usage = await getApiUsage(env, GOOGLE_PLACES_PROVIDER);
  if (usage.count >= monthlyCap) {
    return jsonResponse(
      {
        error: 'monthly_cap_reached',
        detail: `${usage.count}/${monthlyCap} Google Places requests already used for ${usage.period}. Raise GOOGLE_PLACES_MONTHLY_CAP if this is intentional.`,
      },
      429,
    );
  }

  const geohash = geohashEncode(lat, lng, SYNC_DEDUP_GEOHASH_PRECISION);
  if (!force) {
    const recent = await recentSync(env, {
      provider: GOOGLE_PLACES_PROVIDER,
      categorySlug,
      geohash,
      cooldownMs: cooldownDays * 24 * 60 * 60 * 1000,
    });
    if (recent) {
      return jsonResponse(
        {
          error: 'synced_recently',
          detail: `This area+category was already synced ${new Date(recent.synced_at).toISOString()}, within the ${cooldownDays}-day cooldown. Pass {"force": true} to override.`,
        },
        409,
      );
    }
  }

  let results;
  try {
    results = await searchNearby(env, { lat, lng, radiusMeters, categorySlug });
  } catch (e) {
    return jsonResponse({ error: 'google_places_error', detail: String(e.message || e) }, 502);
  }

  // Only counted/logged once the request actually went through and was
  // billed — a validation failure above never touches the quota.
  await incrementApiUsage(env, GOOGLE_PLACES_PROVIDER);
  await recordSync(env, { provider: GOOGLE_PLACES_PROVIDER, categorySlug, geohash, radiusMeters });

  let created = 0;
  let updated = 0;

  for (const result of results) {
    const { sourceId, ...place } = result;
    const existing = await findPlaceBySource(env, 'google', sourceId);
    const placeToSave = existing ? { ...place, id: existing.id } : place;
    const placeId = await upsertPlace(env, placeToSave);
    await linkSource(env, { source: 'google', sourceId, placeId });
    if (existing) updated++;
    else created++;
  }

  const usageAfter = await getApiUsage(env, GOOGLE_PLACES_PROVIDER);

  return jsonResponse({
    synced: results.length,
    created,
    updated,
    monthlyUsage: { period: usageAfter.period, count: usageAfter.count, cap: monthlyCap },
  });
}

async function handleAdminUsage(request, env) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const monthlyCap = env.GOOGLE_PLACES_MONTHLY_CAP
    ? Number(env.GOOGLE_PLACES_MONTHLY_CAP)
    : DEFAULT_MONTHLY_CAP;
  const usage = await getApiUsage(env, GOOGLE_PLACES_PROVIDER);

  return jsonResponse({
    googlePlaces: {
      period: usage.period,
      count: usage.count,
      cap: monthlyCap,
      remaining: Math.max(0, monthlyCap - usage.count),
    },
  });
}

// Moderation queue for the public self-serve submission form (routes/public.js).
// Every self-serve deal lands as pending_review and is invisible via GET
// /deals until approved here.
async function handleAdminPendingDeals(request, env) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const pending = await getPendingDeals(env);

  return jsonResponse({
    deals: pending.map((d) => ({
      id: d.id,
      placeId: d.place_id,
      placeName: d.place_name,
      titleAr: d.title_ar,
      descriptionAr: d.description_ar,
      dealType: d.deal_type,
      value: d.value,
      promoCode: d.promo_code,
      source: d.source,
      createdAt: d.created_at,
    })),
  });
}

const DEAL_REVIEW_STATUSES = new Set(['active', 'rejected']);

async function handleAdminUpdateDealStatus(request, env, dealId) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  if (!DEAL_REVIEW_STATUSES.has(body?.status)) {
    return jsonResponse({ error: 'invalid_status' }, 400);
  }

  await updateDealStatus(env, dealId, body.status);
  return jsonResponse({ dealId, status: body.status });
}

export {
  handleAdminPlaces,
  handleAdminDeals,
  handleAdminSyncGoogle,
  handleAdminUsage,
  handleAdminPendingDeals,
  handleAdminUpdateDealStatus,
};
