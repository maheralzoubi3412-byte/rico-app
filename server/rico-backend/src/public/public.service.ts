import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Business, BusinessDocument } from '../businesses/schemas/business.schema';
import { VendorImpression, VendorImpressionDocument } from './schemas/vendor-impression.schema';
import { SearchGap, SearchGapDocument } from './schemas/search-gap.schema';
import { DealsService } from '../deals/deals.service';
import { SubmitDealDto } from './dto/submit-deal.dto';
import { ImpressionItemDto } from './dto/track-impressions.dto';
import { TrackSearchGapDto } from './dto/track-search-gap.dto';

@Injectable()
export class PublicService {
  constructor(
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(VendorImpression.name) private readonly impressionModel: Model<VendorImpressionDocument>,
    @InjectModel(SearchGap.name) private readonly searchGapModel: Model<SearchGapDocument>,
    private readonly dealsService: DealsService,
  ) {}

  async searchPlaces(q: string) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const places = await this.businessModel
      .find({ $or: [{ name: new RegExp(escaped, 'i') }, { nameAr: new RegExp(escaped, 'i') }] })
      .limit(8)
      .lean();

    return {
      places: places.map((p) => ({
        id: p._id,
        name: p.name,
        nameAr: p.nameAr,
        categorySlug: p.categorySlug,
        city: p.city,
        district: p.district,
      })),
    };
  }

  // The business must already exist in our system — this form intentionally
  // does not let an anonymous caller create a brand-new business (that
  // would let anyone invent a fake business with no review gate at all).
  async submitDeal(dto: SubmitDealDto) {
    const business = await this.businessModel.findById(dto.businessId).lean();
    if (!business) throw new NotFoundException({ error: 'place_not_found' });

    const deal = await this.dealsService.createManual({
      businessId: dto.businessId,
      titleAr: dto.titleAr.trim(),
      descriptionAr: dto.descriptionAr?.trim(),
      dealType: dto.dealType,
      value: dto.value,
      currency: 'SAR',
      promoCode: dto.promoCode?.trim(),
      source: 'partner_selfserve',
      status: 'pending_review',
    });

    return { dealId: deal._id, status: 'pending_review' };
  }

  async trackImpressions(items: ImpressionItemDto[]): Promise<{ tracked: number }> {
    const docs = items.map((item) => ({ businessId: item.businessId, dealId: item.dealId ?? null }));
    const result = await this.impressionModel.insertMany(docs, { ordered: false });
    return { tracked: result.length };
  }

  async trackSearchGap(dto: TrackSearchGapDto): Promise<{ tracked: boolean }> {
    await this.searchGapModel.create({ categorySlug: dto.categorySlug, lat: dto.lat, lng: dto.lng });
    return { tracked: true };
  }
}
