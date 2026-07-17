import express from 'express';
import cors from 'cors';
import Place from '../db/models/Place.js';
import Deal from '../db/models/Deal.js';
import { haversineMeters } from '../lib/geo.js';

const router = express.Router();
const EARTH_RADIUS_METERS = 6371000;

// active_days/active_time need JS evaluation (day-of-week/time-of-day
// windows) — same as the D1 version, ported as-is.
function isActiveNow(deal, now) {
  if (deal.activeDays && deal.activeDays.length > 0) {
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getUTCDay()];
    if (!deal.activeDays.includes(dayKey)) return false;
  }

  if (deal.activeTime && deal.activeTime.from && deal.activeTime.to) {
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const [fromH, fromM] = deal.activeTime.from.split(':').map(Number);
    const [toH, toM] = deal.activeTime.to.split(':').map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;
    if (minutes < fromMinutes || minutes > toMinutes) return false;
  }

  return true;
}

// GET /deals?lat&lng&radius&now=
// Ported from server/rico-api/src/routes/deals.js: find places in range via
// Mongo's native $geoWithin (replaces the old bbox prefilter), then the
// deals referencing them. cors() is per-route, not router.use() — see
// routes/search.js for why.
router.get('/deals', cors(), async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusMeters = req.query.radius !== undefined ? Number(req.query.radius) : 3000;
  const now = req.query.now !== undefined ? new Date(Number(req.query.now)) : new Date();

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ error: 'invalid_lat' });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'invalid_lng' });
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) {
    return res.status(400).json({ error: 'invalid_radius' });
  }

  const nearbyPlaces = await Place.find({
    location: { $geoWithin: { $centerSphere: [[lng, lat], radiusMeters / EARTH_RADIUS_METERS] } },
  }).lean();

  const placeById = new Map(nearbyPlaces.map((p) => [String(p._id), p]));

  const deals = await Deal.find({
    placeId: { $in: nearbyPlaces.map((p) => p._id) },
    status: 'active',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
    ],
  }).lean();

  const withDistance = deals
    .map((d) => {
      const place = placeById.get(String(d.placeId));
      return {
        ...d,
        placeName: place.name,
        distanceMeters: haversineMeters(lat, lng, place.location.coordinates[1], place.location.coordinates[0]),
      };
    })
    .filter((d) => isActiveNow(d, now));

  withDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);

  res.json({
    deals: withDistance.slice(0, 8).map((d) => ({
      id: d._id,
      placeId: d.placeId,
      placeName: d.placeName,
      titleAr: d.titleAr,
      descriptionAr: d.descriptionAr,
      dealType: d.dealType,
      value: d.value,
      currency: d.currency,
      promoCode: d.promoCode,
      distanceMeters: d.distanceMeters,
      source: d.source,
      sourceRef: d.sourceRef,
    })),
  });
});

export default router;
