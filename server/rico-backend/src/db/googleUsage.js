import ApiUsage from './models/ApiUsage.js';
import SyncLog from './models/SyncLog.js';

const EARTH_RADIUS_METERS = 6371000;
// ~20km — coarse cooldown radius, roughly matching the old 4-char geohash
// cell's neighborhood/city granularity (cooldowns aren't meant to be exact-point).
const COOLDOWN_RADIUS_METERS = 20000;

function currentPeriod() {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}`;
}

async function getApiUsage(provider) {
  const period = currentPeriod();
  const row = await ApiUsage.findOne({ provider, period }).lean();
  return { period, count: row ? row.requestCount : 0 };
}

async function incrementApiUsage(provider, by = 1) {
  const period = currentPeriod();
  await ApiUsage.findOneAndUpdate(
    { provider, period },
    { $inc: { requestCount: by } },
    { upsert: true },
  );
}

// Ported from D1's recentSync, but using a real geospatial radius query
// (native $geoWithin) instead of an exact geohash-prefix match.
async function recentSync({ provider, categorySlug, lat, lng, cooldownMs }) {
  const cutoff = new Date(Date.now() - cooldownMs);
  const row = await SyncLog.findOne({
    provider,
    categorySlug,
    syncedAt: { $gt: cutoff },
    location: {
      $geoWithin: { $centerSphere: [[lng, lat], COOLDOWN_RADIUS_METERS / EARTH_RADIUS_METERS] },
    },
  })
    .sort({ syncedAt: -1 })
    .lean();
  return row ?? null;
}

async function recordSync({ provider, categorySlug, lat, lng, radiusMeters }) {
  await SyncLog.create({
    provider,
    categorySlug,
    location: { type: 'Point', coordinates: [lng, lat] },
    radiusMeters,
  });
}

export { getApiUsage, incrementApiUsage, recentSync, recordSync };
