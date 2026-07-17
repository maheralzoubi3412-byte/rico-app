// Geohash / bounding-box / Haversine helpers.
// D1 has no geospatial index, so callers should: bboxForRadius() -> SQL
// prefilter on lat/lng -> haversineMeters() to refine + sort in the Worker.

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const EARTH_RADIUS_METERS = 6371000;

// 6 chars ~= 1.2km x 0.6km cell — coarse prefilter only, real ranking uses
// haversineMeters() on the bbox-filtered rows.
function geohashEncode(lat, lng, precision = 6) {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let isEven = true;
  let bit = 0;
  let ch = 0;
  let hash = '';

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) + 1;
        lngMin = mid;
      } else {
        ch = ch << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) + 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    isEven = !isEven;

    if (bit < 4) {
      bit++;
    } else {
      hash += GEOHASH_BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Degrees-per-meter varies with latitude for longitude; latitude is constant.
function bboxForRadius(lat, lng, radiusMeters) {
  const latDelta = radiusMeters / 111320; // ~meters per degree latitude
  const lngDelta = radiusMeters / (111320 * Math.cos(toRadians(lat)) || 1);
  return {
    latMin: lat - latDelta,
    latMax: lat + latDelta,
    lngMin: lng - lngDelta,
    lngMax: lng + lngDelta,
  };
}

export { geohashEncode, haversineMeters, bboxForRadius };
