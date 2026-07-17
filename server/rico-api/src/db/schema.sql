-- Rico API — D1 schema
-- Source-agnostic place profile + discounts. See server/rico-api/README or the
-- product plan for the rationale behind place_source_links.

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  category_slug TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  geohash TEXT NOT NULL,
  city TEXT,
  district TEXT,
  address TEXT,
  phone TEXT,
  opening_hours TEXT,
  price_level INTEGER,
  rating REAL,
  rating_count INTEGER,
  enrichment_source TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_places_geohash ON places(geohash);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category_slug);
CREATE INDEX IF NOT EXISTS idx_places_lat_lng ON places(lat, lng);

CREATE TABLE IF NOT EXISTS place_source_links (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  place_id TEXT NOT NULL REFERENCES places(id),
  PRIMARY KEY (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_source_links_place ON place_source_links(place_id);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  deal_type TEXT NOT NULL, -- percent | fixed | bogo | free_item | bundle
  value REAL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  promo_code TEXT,
  starts_at INTEGER,
  ends_at INTEGER,
  active_days TEXT, -- JSON array, e.g. ["fri","sat"]
  active_time TEXT, -- JSON object, e.g. {"from":"16:00","to":"19:00"}
  status TEXT NOT NULL DEFAULT 'active', -- active | pending_review | expired
  source TEXT NOT NULL, -- manual | google | partner_selfserve | aggregator
  source_ref TEXT,
  verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_place ON deals(place_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

-- Guardrails for paid external APIs (currently just Google Places). Kept
-- generic by `provider` so any future paid source reuses the same cap logic.
CREATE TABLE IF NOT EXISTS api_usage (
  provider TEXT NOT NULL,
  period TEXT NOT NULL, -- calendar month bucket, 'YYYY-MM' (UTC)
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, period)
);

-- Prevents re-syncing the same area+category from Google before its data
-- could plausibly have changed, which would just burn paid requests for no
-- new information.
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  geohash TEXT NOT NULL, -- coarse (4-char, ~20-40km cell) dedup key, not places.geohash's 6-char precision
  radius_meters INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_lookup ON sync_log(provider, category_slug, geohash);
