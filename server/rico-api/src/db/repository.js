// Single data-access boundary for D1. If D1's lack of a geospatial index is
// ever outgrown, only this file (plus geo.js) needs to change to move to
// Postgres/PostGIS — routes and adapters never talk to D1 directly.

import { geohashEncode, haversineMeters, bboxForRadius } from '../lib/geo.js';

function newId() {
  return crypto.randomUUID();
}

async function upsertPlace(env, place) {
  const id = place.id || newId();
  const geohash = geohashEncode(place.lat, place.lng);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO places
      (id, name, name_ar, category_slug, lat, lng, geohash, city, district, address,
       phone, opening_hours, price_level, rating, rating_count, enrichment_source, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, name_ar=excluded.name_ar, category_slug=excluded.category_slug,
       lat=excluded.lat, lng=excluded.lng, geohash=excluded.geohash, city=excluded.city,
       district=excluded.district, address=excluded.address, phone=excluded.phone,
       opening_hours=excluded.opening_hours, price_level=excluded.price_level,
       rating=excluded.rating, rating_count=excluded.rating_count,
       enrichment_source=excluded.enrichment_source, updated_at=excluded.updated_at`,
  )
    .bind(
      id,
      place.name,
      place.nameAr ?? null,
      place.categorySlug,
      place.lat,
      place.lng,
      geohash,
      place.city ?? null,
      place.district ?? null,
      place.address ?? null,
      place.phone ?? null,
      place.openingHours ?? null,
      place.priceLevel ?? null,
      place.rating ?? null,
      place.ratingCount ?? null,
      place.enrichmentSource ?? null,
      now,
    )
    .run();

  return id;
}

async function linkSource(env, { source, sourceId, placeId }) {
  await env.DB.prepare(
    `INSERT INTO place_source_links (source, source_id, place_id) VALUES (?,?,?)
     ON CONFLICT(source, source_id) DO UPDATE SET place_id=excluded.place_id`,
  )
    .bind(source, sourceId, placeId)
    .run();
}

async function findPlaceBySource(env, source, sourceId) {
  const row = await env.DB.prepare(
    `SELECT p.* FROM places p
     JOIN place_source_links l ON l.place_id = p.id
     WHERE l.source = ? AND l.source_id = ?`,
  )
    .bind(source, sourceId)
    .first();
  return row ?? null;
}

async function placesNearby(env, { lat, lng, radiusMeters = 3000, categorySlug, rank = 'nearest', limit = 8 }) {
  const bbox = bboxForRadius(lat, lng, radiusMeters);

  // NULLS LAST isn't supported by SQLite's ORDER BY directly; emulate with a
  // CASE so priceless/unrated rows always sink below ranked ones.
  const orderClause =
    rank === 'cheapest'
      ? 'ORDER BY (price_level IS NULL) ASC, price_level ASC'
      : rank === 'best_rated'
        ? 'ORDER BY (rating IS NULL) ASC, rating DESC, rating_count DESC'
        : ''; // nearest: sorted by distance below, after the Haversine refine

  const { results } = await env.DB.prepare(
    `SELECT * FROM places
     WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
       AND (? IS NULL OR category_slug = ?)
     ${orderClause}
     LIMIT ?`,
  )
    .bind(bbox.latMin, bbox.latMax, bbox.lngMin, bbox.lngMax, categorySlug ?? null, categorySlug ?? null, limit * 3)
    .all();

  const withDistance = results.map((row) => ({
    ...row,
    distanceMeters: haversineMeters(lat, lng, row.lat, row.lng),
  }));

  // Only `nearest` re-sorts by distance here — `cheapest`/`best_rated` must
  // keep the SQL's price/rating order, otherwise this silently degrades back
  // to a distance sort regardless of what was actually asked for.
  if (rank === 'nearest') {
    withDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  return withDistance.slice(0, limit);
}

async function findPlaceById(env, id) {
  const row = await env.DB.prepare(`SELECT * FROM places WHERE id = ?`).bind(id).first();
  return row ?? null;
}

// Simple substring match on name/name_ar for the self-serve form's business
// picker — not meant for end-user search (no ranking, no location).
async function searchPlacesByName(env, { query, limit = 8 }) {
  const like = `%${query}%`;
  const { results } = await env.DB.prepare(
    `SELECT id, name, name_ar, category_slug, city, district FROM places
     WHERE name LIKE ? OR name_ar LIKE ?
     LIMIT ?`,
  )
    .bind(like, like, limit)
    .all();
  return results;
}

async function getPendingDeals(env) {
  const { results } = await env.DB.prepare(
    `SELECT d.*, p.name AS place_name FROM deals d
     JOIN places p ON p.id = d.place_id
     WHERE d.status = 'pending_review'
     ORDER BY d.created_at ASC`,
  ).all();
  return results;
}

async function updateDealStatus(env, dealId, status) {
  await env.DB.prepare(`UPDATE deals SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, Date.now(), dealId)
    .run();
}

async function upsertDeal(env, deal) {
  const id = deal.id || newId();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO deals
      (id, place_id, title_ar, description_ar, deal_type, value, currency, promo_code,
       starts_at, ends_at, active_days, active_time, status, source, source_ref,
       verified_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title_ar=excluded.title_ar, description_ar=excluded.description_ar,
       deal_type=excluded.deal_type, value=excluded.value, currency=excluded.currency,
       promo_code=excluded.promo_code, starts_at=excluded.starts_at, ends_at=excluded.ends_at,
       active_days=excluded.active_days, active_time=excluded.active_time,
       status=excluded.status, source=excluded.source, source_ref=excluded.source_ref,
       verified_at=excluded.verified_at, updated_at=excluded.updated_at`,
  )
    .bind(
      id,
      deal.placeId,
      deal.titleAr,
      deal.descriptionAr ?? null,
      deal.dealType,
      deal.value ?? null,
      deal.currency ?? 'SAR',
      deal.promoCode ?? null,
      deal.startsAt ?? null,
      deal.endsAt ?? null,
      deal.activeDays ? JSON.stringify(deal.activeDays) : null,
      deal.activeTime ? JSON.stringify(deal.activeTime) : null,
      deal.status ?? 'active',
      deal.source,
      deal.sourceRef ?? null,
      deal.verifiedAt ?? null,
      now,
      now,
    )
    .run();

  return id;
}

async function activeDealsNear(env, { lat, lng, radiusMeters = 3000, now = Date.now(), limit = 8 }) {
  const bbox = bboxForRadius(lat, lng, radiusMeters);

  const { results } = await env.DB.prepare(
    `SELECT d.*, p.name AS place_name, p.lat AS place_lat, p.lng AS place_lng
     FROM deals d
     JOIN places p ON p.id = d.place_id
     WHERE d.status = 'active'
       AND (d.starts_at IS NULL OR d.starts_at <= ?)
       AND (d.ends_at IS NULL OR d.ends_at > ?)
       AND p.lat BETWEEN ? AND ? AND p.lng BETWEEN ? AND ?`,
  )
    .bind(now, now, bbox.latMin, bbox.latMax, bbox.lngMin, bbox.lngMax)
    .all();

  const withDistance = results
    .map((row) => ({
      ...row,
      distanceMeters: haversineMeters(lat, lng, row.place_lat, row.place_lng),
    }))
    .filter((row) => isActiveNow(row, now));

  withDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return withDistance.slice(0, limit);
}

// active_days/active_time are JSON text columns — SQLite can't evaluate them,
// so the day/time-window check happens here after the SQL fetch.
function isActiveNow(deal, nowMs) {
  const date = new Date(nowMs);

  if (deal.active_days) {
    const days = JSON.parse(deal.active_days);
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getUTCDay()];
    if (!days.includes(dayKey)) return false;
  }

  if (deal.active_time) {
    const { from, to } = JSON.parse(deal.active_time);
    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    const [fromH, fromM] = from.split(':').map(Number);
    const [toH, toM] = to.split(':').map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;
    if (minutes < fromMinutes || minutes > toMinutes) return false;
  }

  return true;
}

function currentPeriod() {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}`;
}

// Calendar-month usage counter for paid external APIs, keyed generically by
// `provider` so any future paid source (not just Google Places) reuses this.
async function getApiUsage(env, provider) {
  const period = currentPeriod();
  const row = await env.DB.prepare(
    `SELECT request_count FROM api_usage WHERE provider = ? AND period = ?`,
  )
    .bind(provider, period)
    .first();
  return { period, count: row ? row.request_count : 0 };
}

async function incrementApiUsage(env, provider, by = 1) {
  const period = currentPeriod();
  await env.DB.prepare(
    `INSERT INTO api_usage (provider, period, request_count) VALUES (?, ?, ?)
     ON CONFLICT(provider, period) DO UPDATE SET request_count = request_count + excluded.request_count`,
  )
    .bind(provider, period, by)
    .run();
}

// Coarse (~20-40km cell, precision 4) dedup key — sync cooldowns operate at
// neighborhood/city granularity, not places' exact-point precision.
async function recentSync(env, { provider, categorySlug, geohash, cooldownMs }) {
  const cutoff = Date.now() - cooldownMs;
  const row = await env.DB.prepare(
    `SELECT id, synced_at FROM sync_log
     WHERE provider = ? AND category_slug = ? AND geohash = ? AND synced_at > ?
     ORDER BY synced_at DESC LIMIT 1`,
  )
    .bind(provider, categorySlug, geohash, cutoff)
    .first();
  return row ?? null;
}

async function recordSync(env, { provider, categorySlug, geohash, radiusMeters }) {
  await env.DB.prepare(
    `INSERT INTO sync_log (id, provider, category_slug, geohash, radius_meters, synced_at) VALUES (?,?,?,?,?,?)`,
  )
    .bind(crypto.randomUUID(), provider, categorySlug, geohash, radiusMeters, Date.now())
    .run();
}

export {
  upsertPlace,
  linkSource,
  findPlaceBySource,
  findPlaceById,
  searchPlacesByName,
  placesNearby,
  upsertDeal,
  activeDealsNear,
  getPendingDeals,
  updateDealStatus,
  getApiUsage,
  incrementApiUsage,
  recentSync,
  recordSync,
};
