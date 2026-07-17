// Business account auth (email magic-link) + place claims. Session cookie
// is same-origin (this router is served by the same Express app as the
// dashboard that calls it), so no CORS is applied here at all — see the
// design-review notes in the project plan on why that matters.

import express from 'express';
import BusinessAccount from '../db/models/BusinessAccount.js';
import MagicLinkToken from '../db/models/MagicLinkToken.js';
import BusinessPlaceLink from '../db/models/BusinessPlaceLink.js';
import Place from '../db/models/Place.js';
import Deal from '../db/models/Deal.js';
import { generateToken, hashToken } from '../lib/auth.js';
import { sendMagicLinkEmail } from '../lib/email.js';
import requireBusinessSession from '../middleware/requireBusinessSession.js';
import { loginIpLimiter, loginEmailLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

// POST /business/login {email}
// Always returns the same generic response regardless of whether the email
// is known, rate-limited, or malformed-but-passed-basic-checks — anti
// account-enumeration. Only a genuinely valid, not-yet-rate-limited email
// actually gets an account created + email sent.
router.post('/business/login', loginIpLimiter, loginEmailLimiter, async (req, res) => {
  const GENERIC_RESPONSE = { message: 'إذا كان هذا البريد مسجلاً، سنرسل رابط تسجيل الدخول إليه.' };

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return res.json(GENERIC_RESPONSE);
  }

  const business = await BusinessAccount.findOneAndUpdate(
    { email },
    { $setOnInsert: { email } },
    { upsert: true, new: true },
  );

  // Short cooldown so a double-click/double-submit doesn't fire two emails
  // for the same login attempt.
  const recentToken = await MagicLinkToken.findOne({
    businessId: business._id,
    usedAt: null,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
  });
  if (recentToken) {
    return res.json(GENERIC_RESPONSE);
  }

  // Invalidate prior unused tokens — only the newest link should ever work.
  await MagicLinkToken.updateMany(
    { businessId: business._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  const { token, tokenHash } = generateToken();
  await MagicLinkToken.create({
    tokenHash,
    businessId: business._id,
    expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
  });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const link = `${baseUrl}/business/verify?token=${token}`;

  try {
    await sendMagicLinkEmail({ email, link });
  } catch (e) {
    console.error('Failed to send magic link email:', e.message || e);
    // Still return the generic response — don't leak email-send failures
    // to the caller (same anti-enumeration reasoning).
  }

  res.json(GENERIC_RESPONSE);
});

// GET /business/verify?token=...
// Redirects only to a fixed internal path — never a client-supplied target.
router.get('/business/verify', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(400).send('رابط غير صالح.');

  const tokenHash = hashToken(token);

  // Atomic: validate-and-consume in one operation so a double-open of the
  // same link (or a race) can't both succeed.
  const record = await MagicLinkToken.findOneAndUpdate(
    { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );

  if (!record) {
    return res.status(400).send('رابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.');
  }

  await BusinessAccount.findByIdAndUpdate(record.businessId, { lastLoginAt: new Date() });

  // Regenerate the session on login (prevents session fixation) before
  // setting the authenticated businessId.
  req.session.regenerate((err) => {
    if (err) return res.status(500).send('حدث خطأ، حاول مرة أخرى.');
    req.session.businessId = String(record.businessId);
    res.redirect('/business/dashboard');
  });
});

router.post('/business/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/business/me', requireBusinessSession, async (req, res) => {
  const business = await BusinessAccount.findById(req.session.businessId).lean();
  if (!business) return res.status(401).json({ error: 'unauthorized' });

  const claims = await BusinessPlaceLink.find({ businessId: business._id })
    .populate('placeId', 'name nameAr categorySlug')
    .lean();

  res.json({
    email: business.email,
    claims: claims.map((c) => ({
      placeId: c.placeId._id,
      placeName: c.placeId.nameAr || c.placeId.name,
      categorySlug: c.placeId.categorySlug,
      status: c.status,
    })),
  });
});

// POST /business/claim-place {placeId}
router.post('/business/claim-place', requireBusinessSession, async (req, res) => {
  const placeId = typeof req.body?.placeId === 'string' ? req.body.placeId : '';
  const place = placeId ? await Place.findById(placeId).lean() : null;
  if (!place) return res.status(404).json({ error: 'place_not_found' });

  const existing = await BusinessPlaceLink.findOne({ businessId: req.session.businessId, placeId });
  if (existing) {
    return res.status(409).json({ error: 'already_claimed', status: existing.status });
  }

  const claim = await BusinessPlaceLink.create({
    businessId: req.session.businessId,
    placeId,
    status: 'pending_review',
  });

  res.status(201).json({ claimId: claim._id, status: claim.status });
});

// --- Business deal management (scoped to the caller's active claims only) ---

async function activePlaceIdsForBusiness(businessId) {
  const claims = await BusinessPlaceLink.find({ businessId, status: 'active' }).lean();
  return claims.map((c) => String(c.placeId));
}

router.get('/business/deals', requireBusinessSession, async (req, res) => {
  const placeIds = await activePlaceIdsForBusiness(req.session.businessId);
  const deals = await Deal.find({ businessId: req.session.businessId, placeId: { $in: placeIds } })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    deals: deals.map((d) => ({
      id: d._id,
      placeId: d.placeId,
      titleAr: d.titleAr,
      descriptionAr: d.descriptionAr,
      dealType: d.dealType,
      value: d.value,
      promoCode: d.promoCode,
      status: d.status,
    })),
  });
}
);

const DEAL_TYPES = new Set(['percent', 'fixed', 'bogo', 'free_item', 'bundle']);

router.post('/business/deals', requireBusinessSession, async (req, res) => {
  const placeId = typeof req.body?.placeId === 'string' ? req.body.placeId : '';
  const titleAr = typeof req.body?.titleAr === 'string' ? req.body.titleAr.trim() : '';
  const dealType = typeof req.body?.dealType === 'string' ? req.body.dealType : '';

  if (!titleAr || titleAr.length > 120) return res.status(400).json({ error: 'invalid_title' });
  if (!DEAL_TYPES.has(dealType)) return res.status(400).json({ error: 'invalid_deal_type' });

  // Ownership check (IDOR guard): the place must be one of THIS business's
  // *active* (admin-approved) claims — not just any place that exists.
  const activePlaceIds = await activePlaceIdsForBusiness(req.session.businessId);
  if (!activePlaceIds.includes(placeId)) {
    return res.status(403).json({ error: 'place_not_claimed' });
  }

  const value =
    req.body?.value !== undefined && req.body?.value !== null && req.body.value !== ''
      ? Number(req.body.value)
      : null;

  const deal = await Deal.create({
    placeId,
    titleAr,
    descriptionAr: typeof req.body?.descriptionAr === 'string' ? req.body.descriptionAr.trim() : null,
    dealType,
    value,
    promoCode: typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim() : null,
    status: 'active', // auto-published — the claim review is the trust gate, not each deal
    source: 'business_dashboard',
    businessId: req.session.businessId,
    verifiedAt: new Date(),
  });

  res.status(201).json({ dealId: deal._id });
});

router.patch('/business/deals/:id', requireBusinessSession, async (req, res) => {
  // Ownership check enforced directly in the query filter, not just by
  // fetching-then-checking — a business can only ever match+modify its own
  // deal, full stop.
  const deal = await Deal.findOneAndUpdate(
    { _id: req.params.id, businessId: req.session.businessId },
    {
      $set: {
        ...(typeof req.body?.titleAr === 'string' ? { titleAr: req.body.titleAr.trim() } : {}),
        ...(typeof req.body?.descriptionAr === 'string' ? { descriptionAr: req.body.descriptionAr.trim() } : {}),
        ...(req.body?.status === 'expired' ? { status: 'expired' } : {}),
      },
    },
    { new: true },
  );

  if (!deal) return res.status(404).json({ error: 'deal_not_found' });
  res.json({ dealId: deal._id, status: deal.status });
});

export default router;
