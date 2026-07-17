// Public GET endpoints (/search, /deals) and the /admin/* writes are all
// meant to be called directly from the Flutter web build's browser context,
// which enforces CORS. Admin endpoints stay protected by their bearer token
// regardless — CORS only governs whether browser JS can *read* a response,
// not whether a request reaches the server, so allowing '*' here doesn't
// weaken that boundary.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function corsPreflightResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export { jsonResponse, corsPreflightResponse, CORS_HEADERS };
