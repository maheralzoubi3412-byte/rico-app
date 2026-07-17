// Only haversine survives from the D1 version's geo.js — geohash/bbox
// prefiltering was a workaround for D1 having no geo index. MongoDB's
// 2dsphere index + $near queries handle radius search and distance sort
// natively, so that logic isn't ported.

const EARTH_RADIUS_METERS = 6371000;

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

export { haversineMeters };
