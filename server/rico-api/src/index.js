import {
  handleAdminPlaces,
  handleAdminDeals,
  handleAdminSyncGoogle,
  handleAdminUsage,
  handleAdminPendingDeals,
  handleAdminUpdateDealStatus,
} from './routes/admin.js';
import { handleDeals } from './routes/deals.js';
import { handleSearch } from './routes/search.js';
import { handleSubmitDealForm, handlePlacesSearch, handleSubmitDeal } from './routes/public.js';
import { jsonResponse, corsPreflightResponse } from './lib/http.js';

const DEAL_STATUS_PATH = /^\/admin\/deals\/([^/]+)\/status$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsPreflightResponse();
    }

    if (request.method === 'POST' && url.pathname === '/admin/places') {
      return handleAdminPlaces(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/admin/deals') {
      return handleAdminDeals(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/admin/sync-google') {
      return handleAdminSyncGoogle(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/admin/usage') {
      return handleAdminUsage(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/admin/deals/pending') {
      return handleAdminPendingDeals(request, env);
    }
    if (request.method === 'PATCH') {
      const match = url.pathname.match(DEAL_STATUS_PATH);
      if (match) return handleAdminUpdateDealStatus(request, env, match[1]);
    }
    if (request.method === 'GET' && url.pathname === '/deals') {
      return handleDeals(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/search') {
      return handleSearch(request, env);
    }

    // Restaurant self-serve deal submission (public, no admin token).
    if (request.method === 'GET' && url.pathname === '/submit-deal') {
      return handleSubmitDealForm();
    }
    if (request.method === 'GET' && url.pathname === '/places/search') {
      return handlePlacesSearch(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/submit-deal') {
      return handleSubmitDeal(request, env);
    }

    return jsonResponse({ error: 'not_found' }, 404);
  },
};
