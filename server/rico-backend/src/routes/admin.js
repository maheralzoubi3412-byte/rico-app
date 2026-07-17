import express from 'express';
import Deal from '../db/models/Deal.js';
import BusinessPlaceLink from '../db/models/BusinessPlaceLink.js';
import { normalizePlace, normalizeDeal } from '../adapters/manual.js';
import { searchNearby, GOOGLE_TYPE_BY_CATEGORY } from '../adapters/googlePlaces.js';
import { upsertPlaceBySource } from '../db/placeHelpers.js';
import { getApiUsage, incrementApiUsage, recentSync, recordSync } from '../db/googleUsage.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();
router.use(requireAdmin);

const GOOGLE_PLACES_PROVIDER = 'google_places';
const DEFAULT_MONTHLY_CAP = 200; // conservative — well under any plausible free-tier ceiling
const DEFAULT_COOLDOWN_DAYS = 30; // price/rating data doesn't change fast enough to justify more frequent re-syncs

// POST /admin/places — manual place entry, idempotent by sourceId.
router.post('/places', async (req, res) => {
  const normalized = normalizePlace(req.body);
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  const { place, created } = await upsertPlaceBySource({
    source: 'manual',
    sourceId: normalized.sourceId,
    place: normalized.place,
  });

  res.status(created ? 201 : 200).json({ placeId: place._id });
});

// POST /admin/deals — manual deal entry.
router.post('/deals', async (req, res) => {
  const normalized = normalizeDeal(req.body);
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  const deal = await Deal.create(normalized.deal);
  res.status(201).json({ dealId: deal._id });
});

// POST /admin/sync-google — enriches places with real price_level/rating.
// Ported from server/rico-api/src/routes/admin.js's handleAdminSyncGoogle,
// including the monthly-cap + per-area-cooldown guardrails.
router.post('/sync-google', async (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const radiusMeters = req.body?.radiusMeters !== undefined ? Number(req.body.radiusMeters) : 2000;
  const categorySlug = req.body?.categorySlug;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ error: 'invalid_lat' });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'invalid_lng' });
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) {
    return res.status(400).json({ error: 'invalid_radius' });
  }
  if (!GOOGLE_TYPE_BY_CATEGORY[categorySlug]) {
    return res.status(400).json({ error: 'invalid_category_slug' });
  }

  const monthlyCap = process.env.GOOGLE_PLACES_MONTHLY_CAP
    ? Number(process.env.GOOGLE_PLACES_MONTHLY_CAP)
    : DEFAULT_MONTHLY_CAP;
  const cooldownDays = process.env.GOOGLE_SYNC_COOLDOWN_DAYS
    ? Number(process.env.GOOGLE_SYNC_COOLDOWN_DAYS)
    : DEFAULT_COOLDOWN_DAYS;
  const force = req.body?.force === true;

  const usage = await getApiUsage(GOOGLE_PLACES_PROVIDER);
  if (usage.count >= monthlyCap) {
    return res.status(429).json({
      error: 'monthly_cap_reached',
      detail: `${usage.count}/${monthlyCap} Google Places requests already used for ${usage.period}. Raise GOOGLE_PLACES_MONTHLY_CAP if this is intentional.`,
    });
  }

  if (!force) {
    const recent = await recentSync({
      provider: GOOGLE_PLACES_PROVIDER,
      categorySlug,
      lat,
      lng,
      cooldownMs: cooldownDays * 24 * 60 * 60 * 1000,
    });
    if (recent) {
      return res.status(409).json({
        error: 'synced_recently',
        detail: `This area+category was already synced ${recent.syncedAt.toISOString()}, within the ${cooldownDays}-day cooldown. Pass {"force": true} to override.`,
      });
    }
  }

  let results;
  try {
    results = await searchNearby({ lat, lng, radiusMeters, categorySlug });
  } catch (e) {
    return res.status(502).json({ error: 'google_places_error', detail: String(e.message || e) });
  }

  // Only counted/logged once the request actually went through and was
  // billed — a validation failure above never touches the quota.
  await incrementApiUsage(GOOGLE_PLACES_PROVIDER);
  await recordSync({ provider: GOOGLE_PLACES_PROVIDER, categorySlug, lat, lng, radiusMeters });

  let created = 0;
  let updated = 0;

  for (const result of results) {
    const { sourceId, ...place } = result;
    const { created: wasCreated } = await upsertPlaceBySource({ source: 'google', sourceId, place });
    if (wasCreated) created++;
    else updated++;
  }

  const usageAfter = await getApiUsage(GOOGLE_PLACES_PROVIDER);

  res.json({
    synced: results.length,
    created,
    updated,
    monthlyUsage: { period: usageAfter.period, count: usageAfter.count, cap: monthlyCap },
  });
});

// GET /admin/usage
router.get('/usage', async (req, res) => {
  const monthlyCap = process.env.GOOGLE_PLACES_MONTHLY_CAP
    ? Number(process.env.GOOGLE_PLACES_MONTHLY_CAP)
    : DEFAULT_MONTHLY_CAP;
  const usage = await getApiUsage(GOOGLE_PLACES_PROVIDER);

  res.json({
    googlePlaces: {
      period: usage.period,
      count: usage.count,
      cap: monthlyCap,
      remaining: Math.max(0, monthlyCap - usage.count),
    },
  });
});

// GET /admin/deals/pending — moderation queue for the public self-serve form.
router.get('/deals/pending', async (req, res) => {
  const pending = await Deal.find({ status: 'pending_review' })
    .populate('placeId', 'name')
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    deals: pending.map((d) => ({
      id: d._id,
      placeId: d.placeId._id,
      placeName: d.placeId.name,
      titleAr: d.titleAr,
      descriptionAr: d.descriptionAr,
      dealType: d.dealType,
      value: d.value,
      promoCode: d.promoCode,
      source: d.source,
      createdAt: d.createdAt,
    })),
  });
});

const DEAL_REVIEW_STATUSES = new Set(['active', 'rejected']);

// PATCH /admin/deals/:id/status
router.patch('/deals/:id/status', async (req, res) => {
  if (!DEAL_REVIEW_STATUSES.has(req.body?.status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }

  await Deal.findByIdAndUpdate(req.params.id, { status: req.body.status });
  res.json({ dealId: req.params.id, status: req.body.status });
});

// --- Business place-claim moderation ---
// A claim is a business asserting ownership of a place. Per the design
// review: approving one must be a manual runbook (call the phone number
// already on file for that place) before flipping it to 'active' — the
// code only enforces the gate, not the actual verification.

// GET /admin/claims/pending
router.get('/claims/pending', async (req, res) => {
  const pending = await BusinessPlaceLink.find({ status: 'pending_review' })
    .populate('businessId', 'email')
    .populate('placeId', 'name nameAr phone')
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    claims: pending.map((c) => ({
      id: c._id,
      businessEmail: c.businessId.email,
      placeId: c.placeId._id,
      placeName: c.placeId.nameAr || c.placeId.name,
      placePhone: c.placeId.phone,
      createdAt: c.createdAt,
    })),
  });
});

const CLAIM_REVIEW_STATUSES = new Set(['active', 'rejected', 'suspended']);

// PATCH /admin/claims/:id/status — approving to 'active' or moving to
// 'suspended' both matter operationally; 'suspended' cascades to hide that
// business's deals for this place immediately (revocable trust, not blind).
router.patch('/claims/:id/status', async (req, res) => {
  if (!CLAIM_REVIEW_STATUSES.has(req.body?.status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }

  const claim = await BusinessPlaceLink.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true },
  );
  if (!claim) return res.status(404).json({ error: 'claim_not_found' });

  if (req.body.status === 'suspended' || req.body.status === 'rejected') {
    await Deal.updateMany(
      { businessId: claim.businessId, placeId: claim.placeId, status: 'active' },
      { $set: { status: 'expired' } },
    );
  }

  res.json({ claimId: claim._id, status: claim.status });
});

export default router;
