// Public, unauthenticated endpoints for the restaurant self-serve deal
// submission flow (no admin token — any restaurant owner can call these).
// Every submission lands as status='pending_review'; see routes/admin.js
// for the moderation endpoints that approve/reject before a deal is ever
// visible via GET /deals.

import { normalizeSelfServeDeal } from '../adapters/partner_selfserve.js';
import { searchPlacesByName, findPlaceById, upsertDeal } from '../db/repository.js';
import { jsonResponse } from '../lib/http.js';
import { submitDealPageResponse } from '../lib/submit_deal_page.js';

function handleSubmitDealForm() {
  return submitDealPageResponse();
}

async function handlePlacesSearch(request, env) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  if (q.length < 2 || q.length > 80) {
    return jsonResponse({ error: 'invalid_query' }, 400);
  }

  const places = await searchPlacesByName(env, { query: q, limit: 8 });

  return jsonResponse({
    places: places.map((p) => ({
      id: p.id,
      name: p.name,
      nameAr: p.name_ar,
      categorySlug: p.category_slug,
      city: p.city,
      district: p.district,
    })),
  });
}

async function handleSubmitDeal(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const normalized = normalizeSelfServeDeal(body);
  if (normalized.error) {
    return jsonResponse({ error: normalized.error }, 400);
  }

  // The place must already exist in our system — this form intentionally
  // does not let an anonymous caller create a brand-new place (that would
  // let anyone invent a fake business with no review gate at all, since
  // `places` rows aren't filtered by any status the way `deals` are).
  const place = await findPlaceById(env, normalized.placeId);
  if (!place) {
    return jsonResponse({ error: 'place_not_found' }, 404);
  }

  const dealId = await upsertDeal(env, normalized.deal);
  return jsonResponse({ dealId, status: 'pending_review' }, 201);
}

export { handleSubmitDealForm, handlePlacesSearch, handleSubmitDeal };
