import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Business, BusinessDocument } from '../businesses/schemas/business.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { EARTH_RADIUS_METERS, haversineMeters } from '../common/utils/geo.util';
import { SearchBusinessDto } from './dto/search-business.dto';
import { parseQuery } from './query-parser';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  // GET /search — ported from routes/search.js. Response shape must stay
  // byte-identical: the Flutter app parses this directly. `nearest` uses
  // Mongo's $near (native distance sort); `cheapest`/`best_rated` use
  // $geoWithin (radius filter only) + an explicit JS sort, since $near
  // always sorts by distance and can't be combined with a different sort
  // in the same query.
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

    const withDistance = businesses.map((b) => ({
      ...b,
      distanceMeters: haversineMeters(lat, lng, b.location.coordinates[1], b.location.coordinates[0]),
    }));

    // Never claim a ranking the data can't back up.
    const priceDataAvailable = rank !== 'cheapest' || withDistance.some((b) => b.priceLevel != null);
    const ratingDataAvailable = rank !== 'best_rated' || withDistance.some((b) => b.rating != null);

    return {
      priceDataAvailable,
      ratingDataAvailable,
      places: withDistance.map((b) => ({
        id: b._id,
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
        distanceMeters: b.distanceMeters,
      })),
    };
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
