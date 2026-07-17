import Place from './models/Place.js';

// Shared by /admin/places (manual entry) and /admin/sync-google (Google
// enrichment): find a place already linked to this (source, sourceId) pair
// and update it in place, or create a new one — keeps re-running either
// idempotent instead of creating duplicate rows for the same source record.
async function upsertPlaceBySource({ source, sourceId, place }) {
  const existing = await Place.findOne({ 'sourceLinks.source': source, 'sourceLinks.sourceId': sourceId });

  if (existing) {
    Object.assign(existing, place);
    await existing.save();
    return { place: existing, created: false };
  }

  const created = await Place.create({
    ...place,
    sourceLinks: [{ source, sourceId }],
  });
  return { place: created, created: true };
}

export { upsertPlaceBySource };
