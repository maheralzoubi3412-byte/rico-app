import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Business, BusinessDocument } from '../businesses/schemas/business.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { EARTH_RADIUS_METERS, haversineMeters } from '../common/utils/geo.util';
import { SearchBusinessDto } from './dto/search-business.dto';
import { parseQuery } from './query-parser';
import { ApiUsageService } from '../api-usage/api-usage.service';
import {
  GOOGLE_PLACES_PROVIDER,
  DEFAULT_GOOGLE_PLACES_MONTHLY_CAP,
  GOOGLE_TYPE_BY_CATEGORY,
  searchNearby,
} from '../integrations/google-places.adapter';

interface SearchPlace {
  id: string;
  name: string;
  nameAr: string | null;
  categorySlug: string;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  openingHours: string | null;
  priceLevel: number | null;
  rating: number | null;
  ratingCount: number | null;
  distanceMeters: number;
  source: 'rico' | 'google';
}

function sortByRank(places: SearchPlace[], rank: string): void {
  if (rank === 'nearest') {
    places.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return;
  }
  places.sort((a, b) => {
    const aVal = rank === 'cheapest' ? a.priceLevel : a.rating;
    const bVal = rank === 'cheapest' ? b.priceLevel : b.rating;
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return rank === 'cheapest' ? aVal - bVal : bVal - aVal;
  });
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly apiUsageService: ApiUsageService,
  ) {}

  // GET /search — ported from routes/search.js. Response shape must stay
  // byte-identical (aside from the added `source` field): the Flutter app
  // parses this directly. `nearest` uses Mongo's $near (native distance
  // sort); `cheapest`/`best_rated` use $geoWithin (radius filter only) + an
  // explicit JS sort, since $near always sorts by distance and can't be
  // combined with a different sort in the same query.
  async searchBusinesses(dto: SearchBusinessDto) {
    const { lat, lng } = dto;
    const radiusMeters = dto.radius ?? 3000;
    const rank = dto.rank ?? 'nearest';
    const limit = dto.limit ?? 8;

    const filter: Record<string, unknown> = { isActive: true };
    if (dto.categorySlug) filter.categorySlug = dto.categorySlug;

    let businesses;
    if (rank === 'nearest') {
      filter.location = {
        $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusMeters },
      };
      businesses = await this.businessModel.find(filter).limit(limit).lean();
    } else {
      filter.location = { $geoWithin: { $centerSphere: [[lng, lat], radiusMeters / EARTH_RADIUS_METERS] } };
      // Fetch extra and sort in JS so null price/rating always sinks to the
      // bottom regardless of Mongo's null-sort-order default.
      const raw = await this.businessModel
        .find(filter)
        .limit(limit * 3)
        .lean();
      raw.sort((a, b) => {
        const aVal = rank === 'cheapest' ? a.priceLevel : a.rating;
        const bVal = rank === 'cheapest' ? b.priceLevel : b.rating;
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return rank === 'cheapest' ? aVal - bVal : bVal - aVal;
      });
      businesses = raw.slice(0, limit);
    }

    let places: SearchPlace[] = businesses.map((b) => ({
      id: String(b._id),
      name: b.name,
      nameAr: b.nameAr,
      categorySlug: b.categorySlug,
      lat: b.location.coordinates[1],
      lng: b.location.coordinates[0],
      address: b.address,
      phone: b.phone,
      openingHours: b.openingHours,
      priceLevel: b.priceLevel,
      rating: b.rating,
      ratingCount: b.ratingCount,
      distanceMeters: haversineMeters(lat, lng, b.location.coordinates[1], b.location.coordinates[0]),
      source: 'rico',
    }));

    // Our own DB coverage is necessarily partial (only businesses we've
    // onboarded/synced) — fill the shortfall from Google Places, the
    // global fallback, but only for categories it maps to a known type and
    // only while under the shared monthly budget (see ApiUsageService).
    if (dto.categorySlug && places.length < limit && GOOGLE_TYPE_BY_CATEGORY[dto.categorySlug]) {
      const seenBusinessIds = new Set(places.map((p) => p.id));
      const fallback = await this.fetchGoogleFallback({
        lat,
        lng,
        radiusMeters,
        categorySlug: dto.categorySlug,
        needed: limit - places.length,
        seenBusinessIds,
      });
      places = [...places, ...fallback];
    }

    sortByRank(places, rank);
    places = places.slice(0, limit);

    // Never claim a ranking the data can't back up.
    const priceDataAvailable = rank !== 'cheapest' || places.some((p) => p.priceLevel != null);
    const ratingDataAvailable = rank !== 'best_rated' || places.some((p) => p.rating != null);

    return { priceDataAvailable, ratingDataAvailable, places };
  }

  // Google Places is paid and capped monthly, shared with the admin
  // sourcing-sync tool (ApiUsageService, provider google_places) — any
  // failure here (cap reached, network, API error) degrades silently to
  // whatever the DB already returned rather than breaking the search.
  private async fetchGoogleFallback({
    lat,
    lng,
    radiusMeters,
    categorySlug,
    needed,
    seenBusinessIds,
  }: {
    lat: number;
    lng: number;
    radiusMeters: number;
    categorySlug: string;
    needed: number;
    seenBusinessIds: Set<string>;
  }): Promise<SearchPlace[]> {
    const cap = process.env.GOOGLE_PLACES_MONTHLY_CAP
      ? Number(process.env.GOOGLE_PLACES_MONTHLY_CAP)
      : DEFAULT_GOOGLE_PLACES_MONTHLY_CAP;
    const usage = await this.apiUsageService.getUsage(GOOGLE_PLACES_PROVIDER);
    if (usage.count >= cap) return [];

    let results;
    try {
      results = await searchNearby({ lat, lng, radiusMeters, categorySlug });
      await this.apiUsageService.increment(GOOGLE_PLACES_PROVIDER);
    } catch {
      return [];
    }

    const places: SearchPlace[] = [];
    for (const g of results) {
      if (places.length >= needed) break;

      // Already one of our real businesses (synced earlier via the admin
      // Google-sourcing tool) — surface it with full catalog-backed data
      // instead of the bare Google fields, same treatment as any other
      // 'rico' result (skip it if the DB query above already returned it).
      const matched = await this.businessModel
        .findOne({ 'sourceLinks.source': 'google', 'sourceLinks.sourceId': g.sourceId, isActive: true })
        .lean();

      if (matched) {
        if (seenBusinessIds.has(String(matched._id))) continue;
        seenBusinessIds.add(String(matched._id));
        places.push({
          id: String(matched._id),
          name: matched.name,
          nameAr: matched.nameAr,
          categorySlug: matched.categorySlug,
          lat: matched.location.coordinates[1],
          lng: matched.location.coordinates[0],
          address: matched.address,
          phone: matched.phone,
          openingHours: matched.openingHours,
          priceLevel: matched.priceLevel,
          rating: matched.rating,
          ratingCount: matched.ratingCount,
          distanceMeters: haversineMeters(lat, lng, matched.location.coordinates[1], matched.location.coordinates[0]),
          source: 'rico',
        });
        continue;
      }

      places.push({
        id: g.sourceId,
        name: g.name,
        nameAr: null,
        categorySlug,
        lat: g.location.coordinates[1],
        lng: g.location.coordinates[0],
        address: null,
        phone: null,
        openingHours: null,
        priceLevel: g.priceLevel,
        rating: g.rating,
        ratingCount: g.ratingCount,
        distanceMeters: haversineMeters(lat, lng, g.location.coordinates[1], g.location.coordinates[0]),
        source: 'google',
      });
    }

    return places;
  }

  // GET /search/products — new rule-based product-catalog search (per the
  // local-discovery-platform plan): parse the free-text query, then build a
  // Mongo filter/sort from the structured result. Composition, not
  // injection — parseQuery is a plain function, not a Nest provider.
  async searchProducts(text: string, businessId?: string) {
    const parsed = parseQuery(text);

    const filter: Record<string, unknown> = { isActive: true };
    if (businessId) filter.businessId = businessId;
    if (parsed.category) filter.category = parsed.category;
    for (const [key, value] of Object.entries(parsed.attributes)) {
      filter[`attributes.${key}`] = value;
    }
    if (parsed.keyword) {
      filter.$text = { $search: parsed.keyword };
    }

    const sortStage: Record<string, 1 | -1> =
      parsed.sort === 'price_asc' ? { finalPrice: 1 } : parsed.sort === 'price_desc' ? { finalPrice: -1 } : {};

    const products = await this.productModel.find(filter).sort(sortStage).limit(20).lean();

    return {
      parsed,
      products: products.map((p) => ({
        id: p._id,
        businessId: p.businessId,
        name: p.name,
        category: p.category,
        price: p.price,
        finalPrice: p.finalPrice,
        attributes: p.attributes,
      })),
    };
  }
}
