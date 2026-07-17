// Public, unauthenticated endpoints for the business self-serve deal
// submission flow (no auth — any business owner can call these). Every
// submission lands as status='pending_review'; see routes/admin.js for the
// moderation endpoints that approve/reject before a deal is ever visible
// via GET /deals. Ported from server/rico-api/src/routes/public.js.

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Place from '../db/models/Place.js';
import Deal from '../db/models/Deal.js';
import { normalizeSelfServeDeal } from '../adapters/partnerSelfServe.js';

const router = express.Router();

// Public write endpoint with no auth — cap abuse without adding real
// friction for a legitimate one-off submission.
const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

// Note: GET /submit-deal (the page itself) is now served by the React
// build — see index.js's SPA catch-all. Only the API (this file) stays here.

router.get('/places/search', cors(), async (req, res) => {
  const q = (req.query.q || '').trim();

  if (q.length < 2 || q.length > 80) {
    return res.status(400).json({ error: 'invalid_query' });
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const places = await Place.find({
    $or: [{ name: new RegExp(escaped, 'i') }, { nameAr: new RegExp(escaped, 'i') }],
  })
    .limit(8)
    .lean();

  res.json({
    places: places.map((p) => ({
      id: p._id,
      name: p.name,
      nameAr: p.nameAr,
      categorySlug: p.categorySlug,
      city: p.city,
      district: p.district,
    })),
  });
});

router.post('/submit-deal', cors(), submitLimiter, async (req, res) => {
  const normalized = normalizeSelfServeDeal(req.body);
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  // The place must already exist in our system — this form intentionally
  // does not let an anonymous caller create a brand-new place (that would
  // let anyone invent a fake business with no review gate at all, since
  // `places` rows aren't filtered by any status the way `deals` are).
  const place = await Place.findById(normalized.placeId).lean();
  if (!place) {
    return res.status(404).json({ error: 'place_not_found' });
  }

  const deal = await Deal.create(normalized.deal);
  res.status(201).json({ dealId: deal._id, status: 'pending_review' });
});

export default router;
