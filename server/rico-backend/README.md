# rico-backend

NestJS + MongoDB backend for Rico: a local business discovery platform. Combines:

- A product-catalog MVP (`Business` → `Product` → `Discount`) with a rule-based, non-LLM query parser (category/attribute dictionaries + typo-tolerant fuzzy matching).
- Everything the previous Express backend already had: geo search (`/search`) and nearby deals (`/deals`) with response shapes kept **byte-identical** to the old `rico-api`/`groq-proxy` Cloudflare Workers so the Flutter app only needs its base URLs updated — plus business self-serve accounts (magic-link login), place claims, deal moderation, an admin panel, and Google Places sync.
- A multi-intent Arabic classifier (`/classify`) backed by Groq, ported from `groq-proxy`.

## Requirements

- Node.js 20+
- A MongoDB connection string (Atlas or local)

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Var | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | Mongo connection string |
| `NODE_ENV` | no | `production` enables secure session cookies |
| `PORT` | no | default `3000` |
| `SESSION_SECRET` | yes (prod) | signs the business-dashboard session cookie |
| `ADMIN_TOKEN` | yes | static bearer token for all `/admin/*` routes |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | no | seeds the first `/owner/dashboard` login on first boot only (no-op if an owner account already exists); defaults to `owner@rico.app` / `ChangeMe123!` if unset — change these before a real deploy |
| `GOOGLE_PLACES_API_KEY` | only for `/admin/sync-google` | Google Places API (New) key |
| `GOOGLE_PLACES_MONTHLY_CAP` | no | default `200` |
| `GOOGLE_SYNC_COOLDOWN_DAYS` | no | default `30` |
| `GROQ_API_KEY` | only for `/classify` | Groq Cloud API key |
| `GROQ_MODEL` | no | default `meta-llama/llama-4-scout-17b-16e-instruct` |
| `RESEND_API_KEY` | no | if unset, magic-link emails are logged to the console instead of sent |
| `RESEND_FROM_EMAIL` | no | default `Rico <onboarding@resend.dev>` |

## Run locally

```bash
npm install
npm run start:dev   # nest start --watch, http://localhost:3000
```

No local MongoDB? `scripts/start-dev-db.js` spins up an ephemeral in-memory one:

```bash
node scripts/start-dev-db.js   # prints a MONGODB_URI to put in .env, keep it running
```

## Seed data

```bash
npm run seed
```

Creates ~7 Riyadh-area restaurants/cafes/a boutique (Arabic + English names), a handful of products with keywords in both languages, two active discounts, and two place-level deals — enough to exercise geo search, the rule-based product parser, and `/deals` immediately. Refuses to run against `NODE_ENV=production` unless you pass `--force`.

## Example requests

```bash
# Geo search over businesses (Flutter-contract-critical response shape)
curl "http://localhost:3000/search?lat=24.7136&lng=46.6753&radius=20000&categorySlug=restaurant&rank=cheapest"

# Nearby active deals (Flutter-contract-critical response shape)
curl "http://localhost:3000/deals?lat=24.7136&lng=46.6753&radius=20000"

# Rule-based product-catalog search (new)
curl "http://localhost:3000/search/products?q=%D8%A3%D8%B1%D8%AE%D8%B5%20%D8%B4%D8%A7%D9%88%D8%B1%D9%85%D8%A7"

# Arabic multi-intent classification (requires GROQ_API_KEY)
curl -X POST "http://localhost:3000/classify" -H "Content-Type: application/json" \
  -d '{"message":"أرخص شاورما قريبة"}'

# Admin (requires ADMIN_TOKEN)
curl "http://localhost:3000/admin/usage" -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Tests

```bash
npm test   # jest — currently covers the rule-based query-parser in isolation
```

## Deploy (Render)

One web service running the combined API + static self-serve/admin dashboard (`client/`, built into `client/dist` and served same-origin):

- **Build command:** `npm run build` (runs `nest build`, then builds the Vite client — `--include=dev` is required because Render sets `NODE_ENV=production` during the build step, which would otherwise skip `vite`, a devDependency)
- **Start command:** `npm start`
- Set all env vars above in the Render dashboard.

## Notable design decisions

- **`Business`** absorbs the old `Place` collection — one entity for "a location", referenced by `Product`, `Deal`, and `BusinessClaim`.
- **`Deal.businessId`** now refers to `Business` (was `Place`); the dashboard-account owner ref was renamed to **`Deal.ownerAccountId`** (refs `BusinessAccount`) to avoid two different "business" meanings on the same document. The public JSON response still calls this field `placeId` for Flutter compatibility.
- **`/classify`** is exposed at `POST /classify` (the old `groq-proxy` Worker served it at its root path) — the Flutter client's base URL constant just gets `/classify` appended.
- The classifier's category list intentionally has 11 entries, not 12 — `clothing_store` was a bug introduced in the previous Express port that didn't exist in the original Worker or in Flutter's local category enum.
