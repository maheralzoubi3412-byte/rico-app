import { BadGatewayException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiUsage, ApiUsageDocument } from './schemas/api-usage.schema';
import { SyncLog, SyncLogDocument } from './schemas/sync-log.schema';
import { BusinessClaim, BusinessClaimDocument } from '../business-auth/schemas/business-claim.schema';
import { BusinessAccount, BusinessAccountDocument } from '../business-auth/schemas/business-account.schema';
import { Business, BusinessDocument } from '../businesses/schemas/business.schema';
import { Deal, DealDocument } from '../deals/schemas/deal.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Discount, DiscountDocument } from '../discounts/schemas/discount.schema';
import { VendorImpression, VendorImpressionDocument } from '../public/schemas/vendor-impression.schema';
import { SearchGap, SearchGapDocument } from '../public/schemas/search-gap.schema';
import { toCsv } from '../common/utils/csv.util';
import { BusinessesService } from '../businesses/businesses.service';
import { DealsService } from '../deals/deals.service';
import { CreateBusinessDto } from '../businesses/dto/create-business.dto';
import { CreateDealDto } from '../deals/dto/create-deal.dto';
import { SyncGoogleDto } from './dto/sync-google.dto';
import { ListAdminBusinessesDto } from './dto/list-admin-businesses.dto';
import { ListAdminAccountsDto } from './dto/list-admin-accounts.dto';
import { GOOGLE_TYPE_BY_CATEGORY, searchNearby } from './adapters/google-places.adapter';
import { EARTH_RADIUS_METERS } from '../common/utils/geo.util';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Heuristic, not a hard metric — weighted blend of rating (40%), how many
// active deals a business is running (30%, capped at 3), and whether it has
// left an ownership claim unreviewed for 7+ days (30%). Surfaced in the
// businesses list to help prioritize outreach, not as a precise KPI.
function computeHealthScore({
  rating,
  activeDealsCount,
  hasStaleClaim,
}: {
  rating: number | null | undefined;
  activeDealsCount: number;
  hasStaleClaim: boolean;
}): number {
  const ratingScore = rating ? (rating / 5) * 100 : 0;
  const dealsScore = (Math.min(activeDealsCount, 3) / 3) * 100;
  const claimScore = hasStaleClaim ? 30 : 100;
  return Math.round(ratingScore * 0.4 + dealsScore * 0.3 + claimScore * 0.3);
}

const GOOGLE_PLACES_PROVIDER = 'google_places';
const DEFAULT_MONTHLY_CAP = 200;
const DEFAULT_COOLDOWN_DAYS = 30;
const COOLDOWN_RADIUS_METERS = 20000;

function currentPeriod(): string {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}`;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(ApiUsage.name) private readonly apiUsageModel: Model<ApiUsageDocument>,
    @InjectModel(SyncLog.name) private readonly syncLogModel: Model<SyncLogDocument>,
    @InjectModel(BusinessClaim.name) private readonly claimModel: Model<BusinessClaimDocument>,
    @InjectModel(BusinessAccount.name) private readonly accountModel: Model<BusinessAccountDocument>,
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(Deal.name) private readonly dealModel: Model<DealDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Discount.name) private readonly discountModel: Model<DiscountDocument>,
    @InjectModel(VendorImpression.name) private readonly impressionModel: Model<VendorImpressionDocument>,
    @InjectModel(SearchGap.name) private readonly searchGapModel: Model<SearchGapDocument>,
    private readonly businessesService: BusinessesService,
    private readonly dealsService: DealsService,
  ) {}

  async createManualBusiness(dto: CreateBusinessDto & { sourceId?: string }) {
    const sourceId = dto.sourceId || `manual:${dto.name}:${dto.lat},${dto.lng}`;
    const { business, created } = await this.businessesService.upsertBySource('manual', sourceId, {
      name: dto.name,
      nameAr: dto.nameAr ?? null,
      categorySlug: dto.categorySlug,
      location: { type: 'Point', coordinates: [dto.lng, dto.lat] },
      city: dto.city ?? null,
      district: dto.district ?? null,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      openingHours: dto.openingHours ?? null,
      priceLevel: dto.priceLevel ?? null,
      rating: dto.rating ?? null,
      ratingCount: dto.ratingCount ?? null,
      enrichmentSource: 'manual',
    } as any);
    return { placeId: business._id, created };
  }

  async createManualDeal(dto: CreateDealDto) {
    const deal = await this.dealsService.createManual({ ...dto, source: 'manual', status: 'active' });
    return { dealId: deal._id };
  }

  private async getApiUsage(provider: string): Promise<{ period: string; count: number }> {
    const period = currentPeriod();
    const row = await this.apiUsageModel.findOne({ provider, period }).lean();
    return { period, count: row ? row.requestCount : 0 };
  }

  private async incrementApiUsage(provider: string, by = 1): Promise<void> {
    const period = currentPeriod();
    await this.apiUsageModel.findOneAndUpdate({ provider, period }, { $inc: { requestCount: by } }, { upsert: true });
  }

  private async recentSync({
    provider,
    categorySlug,
    lat,
    lng,
    cooldownMs,
  }: {
    provider: string;
    categorySlug: string;
    lat: number;
    lng: number;
    cooldownMs: number;
  }) {
    const cutoff = new Date(Date.now() - cooldownMs);
    return this.syncLogModel
      .findOne({
        provider,
        categorySlug,
        syncedAt: { $gt: cutoff },
        location: { $geoWithin: { $centerSphere: [[lng, lat], COOLDOWN_RADIUS_METERS / EARTH_RADIUS_METERS] } },
      })
      .sort({ syncedAt: -1 })
      .lean();
  }

  async syncGoogle(dto: SyncGoogleDto) {
    const { lat, lng, categorySlug } = dto;
    const radiusMeters = dto.radiusMeters ?? 2000;

    if (!GOOGLE_TYPE_BY_CATEGORY[categorySlug]) {
      throw new NotFoundException({ error: 'invalid_category_slug' });
    }

    const monthlyCap = process.env.GOOGLE_PLACES_MONTHLY_CAP ? Number(process.env.GOOGLE_PLACES_MONTHLY_CAP) : DEFAULT_MONTHLY_CAP;
    const cooldownDays = process.env.GOOGLE_SYNC_COOLDOWN_DAYS ? Number(process.env.GOOGLE_SYNC_COOLDOWN_DAYS) : DEFAULT_COOLDOWN_DAYS;

    const usage = await this.getApiUsage(GOOGLE_PLACES_PROVIDER);
    if (usage.count >= monthlyCap) {
      throw new HttpException(
        {
          error: 'monthly_cap_reached',
          detail: `${usage.count}/${monthlyCap} Google Places requests already used for ${usage.period}. Raise GOOGLE_PLACES_MONTHLY_CAP if this is intentional.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!dto.force) {
      const recent = await this.recentSync({
        provider: GOOGLE_PLACES_PROVIDER,
        categorySlug,
        lat,
        lng,
        cooldownMs: cooldownDays * 24 * 60 * 60 * 1000,
      });
      if (recent) {
        throw new ConflictException({
          error: 'synced_recently',
          detail: `This area+category was already synced ${recent.syncedAt.toISOString()}, within the ${cooldownDays}-day cooldown. Pass {"force": true} to override.`,
        });
      }
    }

    let results;
    try {
      results = await searchNearby({ lat, lng, radiusMeters, categorySlug });
    } catch (e) {
      throw new BadGatewayException({ error: 'google_places_error', detail: String((e as Error).message || e) });
    }

    await this.incrementApiUsage(GOOGLE_PLACES_PROVIDER);
    await this.syncLogModel.create({
      provider: GOOGLE_PLACES_PROVIDER,
      categorySlug,
      location: { type: 'Point', coordinates: [lng, lat] },
      radiusMeters,
    });

    let created = 0;
    let updated = 0;
    for (const result of results) {
      const { sourceId, ...business } = result;
      const { created: wasCreated } = await this.businessesService.upsertBySource('google', sourceId, business as any);
      if (wasCreated) created++;
      else updated++;
    }

    const usageAfter = await this.getApiUsage(GOOGLE_PLACES_PROVIDER);
    return {
      synced: results.length,
      created,
      updated,
      monthlyUsage: { period: usageAfter.period, count: usageAfter.count, cap: monthlyCap },
    };
  }

  async getUsage() {
    const monthlyCap = process.env.GOOGLE_PLACES_MONTHLY_CAP ? Number(process.env.GOOGLE_PLACES_MONTHLY_CAP) : DEFAULT_MONTHLY_CAP;
    const usage = await this.getApiUsage(GOOGLE_PLACES_PROVIDER);
    return {
      googlePlaces: {
        period: usage.period,
        count: usage.count,
        cap: monthlyCap,
        remaining: Math.max(0, monthlyCap - usage.count),
      },
    };
  }

  async getPendingDeals() {
    return { deals: await this.dealsService.findPendingReview() };
  }

  async reviewDealStatus(id: string, status: string) {
    await this.dealsService.updateStatus(id, status);
    return { dealId: id, status };
  }

  async getPendingClaims() {
    const pending = await this.claimModel
      .find({ status: 'pending_review' })
      .populate('accountId', 'email')
      .populate('businessId', 'name nameAr phone')
      .sort({ createdAt: 1 })
      .lean();

    return {
      claims: pending.map((c: any) => ({
        id: c._id,
        businessEmail: c.accountId.email,
        placeId: c.businessId._id,
        placeName: c.businessId.nameAr || c.businessId.name,
        placePhone: c.businessId.phone,
        createdAt: c.createdAt,
      })),
    };
  }

  // Approving to 'active' or moving to 'suspended' both matter
  // operationally; 'suspended'/'rejected' cascades to hide that account's
  // deals for this business immediately (revocable trust, not blind).
  async reviewClaimStatus(id: string, status: string) {
    const claim = await this.claimModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!claim) throw new NotFoundException({ error: 'claim_not_found' });

    if (status === 'suspended' || status === 'rejected') {
      await this.dealsService.expireForAccountBusiness(claim.accountId, claim.businessId);
    }

    return { claimId: claim._id, status: claim.status };
  }

  async listBusinesses(query: ListAdminBusinessesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};
    if (query.categorySlug) filter.categorySlug = query.categorySlug;
    if (query.search) {
      const re = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: re }, { nameAr: re }];
    }

    const [items, total] = await Promise.all([
      this.businessModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.businessModel.countDocuments(filter),
    ]);

    const businessIds = items.map((b) => b._id);
    const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sparklineDays = 14;
    const sparklineSince = new Date(Date.now() - sparklineDays * 24 * 60 * 60 * 1000);

    const [productCounts, dealCounts, activeClaims, staleClaims, sparklineRows] = await Promise.all([
      this.productModel.aggregate([
        { $match: { businessId: { $in: businessIds }, isActive: true } },
        { $group: { _id: '$businessId', count: { $sum: 1 } } },
      ]),
      this.dealModel.aggregate([
        { $match: { businessId: { $in: businessIds }, status: 'active' } },
        { $group: { _id: '$businessId', count: { $sum: 1 } } },
      ]),
      this.claimModel.find({ businessId: { $in: businessIds }, status: 'active' }).populate('accountId', 'email').lean(),
      this.claimModel
        .find({ businessId: { $in: businessIds }, status: 'pending_review', createdAt: { $lt: staleCutoff } })
        .distinct('businessId'),
      this.impressionModel.aggregate([
        { $match: { businessId: { $in: businessIds }, createdAt: { $gte: sparklineSince } } },
        {
          $group: {
            _id: { businessId: '$businessId', date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const productCountByBusiness = new Map(productCounts.map((r: any) => [String(r._id), r.count]));
    const dealCountByBusiness = new Map(dealCounts.map((r: any) => [String(r._id), r.count]));
    const ownerByBusiness = new Map(activeClaims.map((c: any) => [String(c.businessId), c.accountId?.email ?? null]));
    const staleClaimBusinessIds = new Set(staleClaims.map((id) => String(id)));

    const sparklineByBusiness = new Map<string, Map<string, number>>();
    for (const row of sparklineRows as any[]) {
      const key = String(row._id.businessId);
      if (!sparklineByBusiness.has(key)) sparklineByBusiness.set(key, new Map());
      sparklineByBusiness.get(key)!.set(row._id.date, row.count);
    }

    function buildSparkline(businessId: string): number[] {
      const countByDay = sparklineByBusiness.get(businessId);
      const points: number[] = [];
      for (let i = sparklineDays - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        points.push(countByDay?.get(date) ?? 0);
      }
      return points;
    }

    return {
      items: items.map((b) => {
        const productsCount = productCountByBusiness.get(String(b._id)) ?? 0;
        const activeDealsCount = dealCountByBusiness.get(String(b._id)) ?? 0;
        const hasStaleClaim = staleClaimBusinessIds.has(String(b._id));
        return {
          ...b,
          productsCount,
          activeDealsCount,
          ownerEmail: ownerByBusiness.get(String(b._id)) ?? null,
          healthScore: computeHealthScore({ rating: b.rating, activeDealsCount, hasStaleClaim }),
          sparkline: buildSparkline(String(b._id)),
        };
      }),
      total,
      page,
      limit,
    };
  }

  async getBusinessDetail(id: string) {
    const business = await this.businessModel.findById(id).lean();
    if (!business) throw new NotFoundException({ error: 'business_not_found' });

    const [products, deals, claims] = await Promise.all([
      this.productModel.find({ businessId: id }).sort({ createdAt: -1 }).lean(),
      this.dealModel.find({ businessId: id }).sort({ createdAt: -1 }).lean(),
      this.claimModel.find({ businessId: id }).populate('accountId', 'email').sort({ createdAt: -1 }).lean(),
    ]);

    const productIds = products.map((p) => p._id);
    const discounts = productIds.length ? await this.discountModel.find({ productId: { $in: productIds } }).lean() : [];
    const discountsByProduct = new Map<string, unknown[]>();
    for (const d of discounts) {
      const key = String(d.productId);
      if (!discountsByProduct.has(key)) discountsByProduct.set(key, []);
      discountsByProduct.get(key)!.push(d);
    }

    return {
      business,
      products: products.map((p) => ({ ...p, discounts: discountsByProduct.get(String(p._id)) ?? [] })),
      deals,
      claims: claims.map((c: any) => ({
        id: c._id,
        accountId: c.accountId?._id ?? null,
        accountEmail: c.accountId?.email ?? null,
        status: c.status,
        createdAt: c.createdAt,
      })),
    };
  }

  async setBusinessActive(id: string, isActive: boolean) {
    await this.businessesService.setActive(id, isActive);
    return { businessId: id, isActive };
  }

  async listAccounts(query: ListAdminAccountsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};
    if (query.search) filter.email = new RegExp(escapeRegex(query.search), 'i');

    const [items, total] = await Promise.all([
      this.accountModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.accountModel.countDocuments(filter),
    ]);

    const accountIds = items.map((a) => a._id);
    const claimCounts = await this.claimModel.aggregate([
      { $match: { accountId: { $in: accountIds }, status: 'active' } },
      { $group: { _id: '$accountId', count: { $sum: 1 } } },
    ]);
    const claimCountByAccount = new Map(claimCounts.map((r: any) => [String(r._id), r.count]));

    return {
      items: items.map((a) => ({
        ...a,
        activeBusinessesCount: claimCountByAccount.get(String(a._id)) ?? 0,
      })),
      total,
      page,
      limit,
    };
  }

  async getAccountDetail(id: string) {
    const account = await this.accountModel.findById(id).lean();
    if (!account) throw new NotFoundException({ error: 'account_not_found' });

    const [claims, deals] = await Promise.all([
      this.claimModel.find({ accountId: id }).populate('businessId', 'name nameAr categorySlug').sort({ createdAt: -1 }).lean(),
      this.dealModel.find({ ownerAccountId: id }).populate('businessId', 'name nameAr').sort({ createdAt: -1 }).lean(),
    ]);

    return {
      account,
      claims: claims.map((c: any) => ({
        id: c._id,
        businessId: c.businessId?._id ?? null,
        businessName: c.businessId ? c.businessId.nameAr || c.businessId.name : null,
        categorySlug: c.businessId?.categorySlug ?? null,
        status: c.status,
        createdAt: c.createdAt,
      })),
      deals: deals.map((d: any) => ({
        id: d._id,
        businessName: d.businessId ? d.businessId.nameAr || d.businessId.name : null,
        titleAr: d.titleAr,
        status: d.status,
        dealType: d.dealType,
        value: d.value,
        createdAt: d.createdAt,
      })),
    };
  }

  async getAnalytics() {
    const [
      totalBusinesses,
      activeBusinesses,
      businessesByCategory,
      dealsByStatus,
      activeProducts,
      activeDiscounts,
      totalAccounts,
      claimsByStatus,
      usage,
    ] = await Promise.all([
      this.businessModel.countDocuments({}),
      this.businessModel.countDocuments({ isActive: true }),
      this.businessModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$categorySlug', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.dealModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.productModel.countDocuments({ isActive: true }),
      this.discountModel.countDocuments({ isActive: true }),
      this.accountModel.countDocuments({}),
      this.claimModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.getUsage(),
    ]);

    return {
      businesses: {
        total: totalBusinesses,
        active: activeBusinesses,
        inactive: totalBusinesses - activeBusinesses,
        byCategory: businessesByCategory.map((r: any) => ({ categorySlug: r._id, count: r.count })),
      },
      deals: {
        byStatus: Object.fromEntries(dealsByStatus.map((r: any) => [r._id, r.count])),
      },
      products: { active: activeProducts },
      discounts: { active: activeDiscounts },
      accounts: { total: totalAccounts },
      claims: {
        byStatus: Object.fromEntries(claimsByStatus.map((r: any) => [r._id, r.count])),
      },
      usage,
    };
  }

  async exportBusinessesCsv(): Promise<string> {
    const businesses = await this.businessModel.find({}).sort({ createdAt: -1 }).lean();
    return toCsv(businesses as unknown as Record<string, unknown>[], [
      { key: '_id', header: 'id' },
      { key: 'name', header: 'name' },
      { key: 'nameAr', header: 'nameAr' },
      { key: 'categorySlug', header: 'category' },
      { key: 'city', header: 'city' },
      { key: 'district', header: 'district' },
      { key: 'phone', header: 'phone' },
      { key: 'rating', header: 'rating' },
      { key: 'ratingCount', header: 'ratingCount' },
      { key: 'isActive', header: 'isActive' },
      { key: 'createdAt', header: 'createdAt' },
    ]);
  }

  async exportAccountsCsv(): Promise<string> {
    const accounts = await this.accountModel.find({}).sort({ createdAt: -1 }).lean();
    return toCsv(accounts as unknown as Record<string, unknown>[], [
      { key: '_id', header: 'id' },
      { key: 'email', header: 'email' },
      { key: 'lastLoginAt', header: 'lastLoginAt' },
      { key: 'createdAt', header: 'createdAt' },
    ]);
  }

  async getTopVendors(days: number, limit: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.impressionModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$businessId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    const businessIds = rows.map((r: any) => r._id);
    const businesses = await this.businessModel.find({ _id: { $in: businessIds } }, 'name nameAr categorySlug').lean();
    const businessById = new Map(businesses.map((b) => [String(b._id), b]));

    return {
      days,
      items: rows.map((r: any) => {
        const business = businessById.get(String(r._id));
        return {
          businessId: r._id,
          name: business ? business.nameAr || business.name : 'نشاط محذوف',
          categorySlug: business?.categorySlug ?? null,
          impressions: r.count,
        };
      }),
    };
  }

  // Zero-result category searches — a recruitment signal, distinct from
  // impressions (which measure demand for businesses we already have).
  async getSearchGaps(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.searchGapModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$categorySlug', count: { $sum: 1 }, avgLat: { $avg: '$lat' }, avgLng: { $avg: '$lng' } } },
      { $sort: { count: -1 } },
    ]);
    return {
      days,
      items: rows.map((r: any) => ({ categorySlug: r._id, count: r.count, avgLat: r.avgLat, avgLng: r.avgLng })),
    };
  }

  async getDealTypePerformance(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.impressionModel.aggregate([
      { $match: { createdAt: { $gte: since }, dealId: { $ne: null } } },
      { $lookup: { from: 'deals', localField: 'dealId', foreignField: '_id', as: 'deal' } },
      { $unwind: '$deal' },
      { $group: { _id: '$deal.dealType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return { days, items: rows.map((r: any) => ({ dealType: r._id, count: r.count })) };
  }

  async getExpiringDeals(days: number) {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const deals = await this.dealModel
      .find({ status: 'active', endsAt: { $ne: null, $lte: cutoff, $gt: new Date() } })
      .sort({ endsAt: 1 })
      .populate('businessId', 'name nameAr')
      .lean();

    return {
      days,
      items: deals.map((d: any) => ({
        dealId: d._id,
        businessId: d.businessId?._id ?? null,
        businessName: d.businessId ? d.businessId.nameAr || d.businessId.name : null,
        titleAr: d.titleAr,
        endsAt: d.endsAt,
      })),
    };
  }

  // Daily impression counts for a single business, zero-filled so the chart
  // always shows a continuous `days`-long series regardless of gaps.
  async getBusinessImpressions(businessId: string, days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const businessObjectId = new Types.ObjectId(businessId);

    const [rows, heatmapRows] = await Promise.all([
      this.impressionModel.aggregate([
        { $match: { businessId: businessObjectId, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      this.impressionModel.aggregate([
        { $match: { businessId: businessObjectId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { dayOfWeek: { $dayOfWeek: '$createdAt' }, hour: { $hour: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const countByDay = new Map(rows.map((r: any) => [r._id, r.count]));

    const series: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      series.push({ date, count: countByDay.get(date) ?? 0 });
    }

    // $dayOfWeek is 1 (Sunday) .. 7 (Saturday) in UTC.
    const heatmap = heatmapRows.map((r: any) => ({
      dayOfWeek: r._id.dayOfWeek,
      hour: r._id.hour,
      count: r.count,
    }));

    return { total: series.reduce((sum, s) => sum + s.count, 0), days, series, heatmap };
  }
}
