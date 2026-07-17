// Normalizes deal submissions from the public, unauthenticated self-serve
// form (any business can submit, no admin token). Unlike manual.js's
// normalizeDeal, this NEVER trusts the caller's status/source — every
// submission is forced to pending_review until an admin approves it.
// placeId existence is checked by the route (Place.findById), not here —
// this function only shapes/validates the deal fields themselves.
// Ported verbatim from server/rico-api/src/adapters/partner_selfserve.js.

import { DEAL_TYPES } from './manual.js';

function normalizeSelfServeDeal(input) {
  if (!input || typeof input !== 'object') return { error: 'invalid_body' };

  const placeId = typeof input.placeId === 'string' ? input.placeId.trim() : '';
  const titleAr = typeof input.titleAr === 'string' ? input.titleAr.trim() : '';
  const dealType = typeof input.dealType === 'string' ? input.dealType : '';

  if (!placeId) return { error: 'invalid_place_id' };
  if (!titleAr || titleAr.length > 120) return { error: 'invalid_title' };
  if (!DEAL_TYPES.has(dealType)) return { error: 'invalid_deal_type' };

  const descriptionAr = typeof input.descriptionAr === 'string' ? input.descriptionAr.trim() : null;
  if (descriptionAr && descriptionAr.length > 300) return { error: 'invalid_description' };

  const promoCode = typeof input.promoCode === 'string' ? input.promoCode.trim() : null;
  if (promoCode && promoCode.length > 30) return { error: 'invalid_promo_code' };

  let value = null;
  if (input.value !== undefined && input.value !== null && input.value !== '') {
    value = Number(input.value);
    if (!Number.isFinite(value) || value < 0 || value > 100000) return { error: 'invalid_value' };
  }

  return {
    placeId,
    deal: {
      placeId,
      titleAr,
      descriptionAr,
      dealType,
      value,
      currency: 'SAR',
      promoCode: promoCode || null,
      startsAt: null,
      endsAt: null,
      activeDays: null,
      activeTime: undefined,
      status: 'pending_review',
      source: 'partner_selfserve',
      sourceRef: null,
      verifiedAt: null,
    },
  };
}

export { normalizeSelfServeDeal };
