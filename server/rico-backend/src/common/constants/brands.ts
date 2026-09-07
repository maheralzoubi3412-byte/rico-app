// One backend serves every regional variant of the app, so the assistant's
// name can't be baked into the prompts — the client says which brand is
// asking and the prompt builders interpolate the matching name.
//
// Only the name varies today. Dialect does not: every variant still answers
// in Saudi dialect, so a Jordanian build introduces itself as تدلل but
// speaks like ريكو. That's a deliberate interim state, not an oversight.

export const BRAND_NAMES: Record<string, string> = {
  rico: 'ريكو',
  tadallal: 'تدلل',
};

// Clients already in users' hands send no brand at all, so the default has
// to stay the original one — anything else would silently rename the
// assistant for every installed Rico build.
export const DEFAULT_BRAND = 'rico';

/** Resolves a client-supplied brand slug to a display name, falling back to
 * the default for anything unknown. Never throws: an unrecognized slug is a
 * stale or hand-edited client, and answering as ريكو beats a 400. */
export function brandName(slug?: string): string {
  return (slug && BRAND_NAMES[slug]) || BRAND_NAMES[DEFAULT_BRAND];
}

export const BRAND_SLUGS = Object.keys(BRAND_NAMES);
