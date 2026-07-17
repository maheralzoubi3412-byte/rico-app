import express from 'express';
import cors from 'cors';
import Place from '../db/models/Place.js';
import { haversineMeters } from '../lib/geo.js';

const router = express.Router();

const VALID_RANKS = new Set(['nearest', 'cheapest', 'best_rated']);
const EARTH_RADIUS_METERS = 6371000;

// GET /search?lat&lng&radius&categorySlug&rank&limit
// Ported from server/rico-api/src/routes/search.js. `nearest` uses Mongo's
// $near (native distance sort — replaces the old bbox+Haversine workaround
// D1 needed). `cheapest`/`best_rated` use $geoWithin (radius filter only,
// no forced distance sort) + an explicit sort, since $near always sorts by
// distance and can't be combined with a different sort in the same query.
//
// cors() is applied per-route (not via router.use()) — a router-level
// router.use(cors()) runs for every request the router receives, since this
// router is mounted at the app root, which would leak the header onto any
// unmatched path before it falls through to /admin's router.
router.get('/search', cors(), async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusMeters = req.query.radius !== undefined ? Number(req.query.radius) : 3000;
  const categorySlug = req.query.categorySlug || undefined;
  const rank = req.query.rank || 'nearest';
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : 8;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ error: 'invalid_lat' });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'invalid_lng' });
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) {
    return res.status(400).json({ error: 'invalid_radius' });
  }
  if (!VALID_RANKS.has(rank)) {
    return res.status(400).json({ error: 'invalid_rank' });
  }

  const filter = {};
  if (categorySlug) filter.categorySlug = categorySlug;

  let places;
  if (rank === 'nearest') {
    filter.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusMeters,
      },
    };
    places = await Place.find(filter).limit(limit).lean();
  } else {
    filter.location = {
      $geoWithin: { $centerSphere: [[lng, lat], radiusMeters / EARTH_RADIUS_METERS] },
    };
    // Fetch extra and sort in JS so null price/rating always sinks to the
    // bottom regardless of Mongo's null-sort-order default (which sorts
    // nulls first ascending — the opposite of what "cheapest" should show).
    const raw = await Place.find(filter).limit(limit * 3).lean();
    raw.sort((a, b) => {
      const aVal = rank === 'cheapest' ? a.priceLevel : a.rating;
      const bVal = rank === 'cheapest' ? b.priceLevel : b.rating;
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return rank === 'cheapest' ? aVal - bVal : bVal - aVal;
    });
    places = raw.slice(0, limit);
  }

  const withDistance = places.map((p) => ({
    ...p,
    distanceMeters: haversineMeters(lat, lng, p.location.coordinates[1], p.location.coordinates[0]),
  }));

  // Never claim a ranking the data can't back up.
  const priceDataAvailable = rank !== 'cheapest' || withDistance.some((p) => p.priceLevel != null);
  const ratingDataAvailable = rank !== 'best_rated' || withDistance.some((p) => p.rating != null);

  res.json({
    priceDataAvailable,
    ratingDataAvailable,
    places: withDistance.map((p) => ({
      id: p._id,
      name: p.name,
      nameAr: p.nameAr,
      categorySlug: p.categorySlug,
      lat: p.location.coordinates[1],
      lng: p.location.coordinates[0],
      address: p.address,
      phone: p.phone,
      openingHours: p.openingHours,
      priceLevel: p.priceLevel,
      rating: p.rating,
      ratingCount: p.ratingCount,
      distanceMeters: p.distanceMeters,
    })),
  });
});

export default router;
