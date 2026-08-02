import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BusinessAccount, BusinessAccountDocument } from './schemas/business-account.schema';
import { MagicLinkToken, MagicLinkTokenDocument } from './schemas/magic-link-token.schema';
import { BusinessClaim, BusinessClaimDocument } from './schemas/business-claim.schema';
import { Business, BusinessDocument } from '../businesses/schemas/business.schema';
import { Deal, DealDocument } from '../deals/schemas/deal.schema';
import { generateToken, hashToken } from '../common/utils/auth.util';
import { MailerService } from '../mailer/mailer.service';
import { CreateOwnDealDto } from './dto/create-own-deal.dto';
import { UpdateOwnDealDto } from './dto/update-own-deal.dto';
import { ProductsService } from '../products/products.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { DiscountsService } from '../discounts/discounts.service';
import { CreateDiscountDto } from '../discounts/dto/create-discount.dto';
import { UpdateDiscountDto } from '../discounts/dto/update-discount.dto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
export const GENERIC_LOGIN_RESPONSE = { message: 'إذا كان هذا البريد مسجلاً، سنرسل رابط تسجيل الدخول إليه.' };

@Injectable()
export class BusinessAuthService {
  constructor(
    @InjectModel(BusinessAccount.name) private readonly accountModel: Model<BusinessAccountDocument>,
    @InjectModel(MagicLinkToken.name) private readonly tokenModel: Model<MagicLinkTokenDocument>,
    @InjectModel(BusinessClaim.name) private readonly claimModel: Model<BusinessClaimDocument>,
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(Deal.name) private readonly dealModel: Model<DealDocument>,
    private readonly mailerService: MailerService,
    private readonly productsService: ProductsService,
    private readonly discountsService: DiscountsService,
  ) {}

  // Always returns the generic response regardless of whether the email is
  // known, rate-limited, or malformed — anti account-enumeration. Only a
  // genuinely valid, not-yet-rate-limited email actually gets an account
  // created + email sent.
  async login(rawEmail: string, baseUrl: string): Promise<typeof GENERIC_LOGIN_RESPONSE> {
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return GENERIC_LOGIN_RESPONSE;
    }

    const business = await this.accountModel.findOneAndUpdate(
      { email },
      { $setOnInsert: { email } },
      { upsert: true, new: true },
    );

    const recentToken = await this.tokenModel.findOne({
      businessId: business._id,
      usedAt: null,
      createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    });
    if (recentToken) {
      return GENERIC_LOGIN_RESPONSE;
    }

    await this.tokenModel.updateMany({ businessId: business._id, usedAt: null }, { $set: { usedAt: new Date() } });

    const { token, tokenHash } = generateToken();
    await this.tokenModel.create({
      tokenHash,
      businessId: business._id,
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
    });

    const link = `${baseUrl}/business/verify?token=${token}`;

    try {
      await this.mailerService.sendMagicLinkEmail({ email, link });
    } catch (e) {
      console.error('Failed to send magic link email:', (e as Error).message || e);
    }

    return GENERIC_LOGIN_RESPONSE;
  }

  async verify(token: string): Promise<{ businessId: string }> {
    if (!token) throw new BadRequestException('رابط غير صالح.');

    const tokenHash = hashToken(token);
    const record = await this.tokenModel.findOneAndUpdate(
      { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
    );

    if (!record) {
      throw new BadRequestException('رابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.');
    }

    await this.accountModel.findByIdAndUpdate(record.businessId, { lastLoginAt: new Date() });
    return { businessId: String(record.businessId) };
  }

  async me(businessId: string) {
    const business = await this.accountModel.findById(businessId).lean();
    if (!business) throw new UnauthorizedException({ error: 'unauthorized' });

    const claims = await this.claimModel
      .find({ accountId: business._id })
      .populate('businessId', 'name nameAr categorySlug')
      .lean();

    return {
      email: business.email,
      claims: claims.map((c: any) => ({
        placeId: c.businessId._id,
        placeName: c.businessId.nameAr || c.businessId.name,
        categorySlug: c.businessId.categorySlug,
        status: c.status,
      })),
    };
  }

  async claimBusiness(accountId: string, businessId: string) {
    const business = businessId ? await this.businessModel.findById(businessId).lean() : null;
    if (!business) throw new NotFoundException({ error: 'place_not_found' });

    const existing = await this.claimModel.findOne({ accountId, businessId });
    if (existing) {
      throw new ConflictException({ error: 'already_claimed', status: existing.status });
    }

    // Auto-approved — no owner/admin review step. A vendor can manage
    // products/offers for a business the moment they link it.
    const claim = await this.claimModel.create({ accountId, businessId, status: 'active' });
    return { claimId: claim._id, status: claim.status };
  }

  private async activeBusinessIdsForAccount(accountId: string): Promise<string[]> {
    const claims = await this.claimModel.find({ accountId, status: 'active' }).lean();
    return claims.map((c) => String(c.businessId));
  }

  async listOwnDeals(accountId: string) {
    const businessIds = await this.activeBusinessIdsForAccount(accountId);
    const deals = await this.dealModel
      .find({ ownerAccountId: accountId, businessId: { $in: businessIds } })
      .sort({ createdAt: -1 })
      .lean();

    return {
      deals: deals.map((d) => ({
        id: d._id,
        placeId: d.businessId,
        titleAr: d.titleAr,
        descriptionAr: d.descriptionAr,
        dealType: d.dealType,
        value: d.value,
        promoCode: d.promoCode,
        status: d.status,
      })),
    };
  }

  async createOwnDeal(accountId: string, dto: CreateOwnDealDto) {
    // Ownership check (IDOR guard): the business must be one of THIS
    // account's *active* (admin-approved) claims — not just any business
    // that exists.
    const activeBusinessIds = await this.activeBusinessIdsForAccount(accountId);
    if (!activeBusinessIds.includes(dto.businessId)) {
      throw new ForbiddenException({ error: 'place_not_claimed' });
    }

    const deal = await this.dealModel.create({
      businessId: dto.businessId,
      titleAr: dto.titleAr.trim(),
      descriptionAr: dto.descriptionAr?.trim() ?? null,
      dealType: dto.dealType,
      value: dto.value ?? null,
      promoCode: dto.promoCode?.trim() ?? null,
      status: 'active', // auto-published — the claim review is the trust gate, not each deal
      source: 'business_dashboard',
      ownerAccountId: accountId,
      verifiedAt: new Date(),
    });

    return { dealId: deal._id };
  }

  async updateOwnDeal(accountId: string, dealId: string, dto: UpdateOwnDealDto) {
    // Ownership enforced directly in the query filter, not just by
    // fetching-then-checking — an account can only ever match+modify its
    // own deal, full stop.
    const deal = await this.dealModel.findOneAndUpdate(
      { _id: dealId, ownerAccountId: accountId },
      {
        $set: {
          ...(dto.titleAr !== undefined ? { titleAr: dto.titleAr.trim() } : {}),
          ...(dto.descriptionAr !== undefined ? { descriptionAr: dto.descriptionAr.trim() } : {}),
          ...(dto.status === 'expired' ? { status: 'expired' } : {}),
        },
      },
      { new: true },
    );

    if (!deal) throw new NotFoundException({ error: 'deal_not_found' });
    return { dealId: deal._id, status: deal.status };
  }

  async listOwnProducts(accountId: string, businessId: string) {
    const activeBusinessIds = await this.activeBusinessIdsForAccount(accountId);
    if (!activeBusinessIds.includes(businessId)) {
      throw new ForbiddenException({ error: 'place_not_claimed' });
    }
    return this.productsService.findAll({ businessId, page: 1, limit: 100 });
  }

  async createOwnProduct(accountId: string, dto: CreateProductDto) {
    const activeBusinessIds = await this.activeBusinessIdsForAccount(accountId);
    if (!activeBusinessIds.includes(dto.businessId)) {
      throw new ForbiddenException({ error: 'place_not_claimed' });
    }
    return this.productsService.create(dto);
  }

  async updateOwnProduct(accountId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.productsService.findOne(productId);
    const activeBusinessIds = await this.activeBusinessIdsForAccount(accountId);
    if (!activeBusinessIds.includes(String(product.businessId))) {
      throw new ForbiddenException({ error: 'place_not_claimed' });
    }
    return this.productsService.update(productId, dto);
  }

  async removeOwnProduct(accountId: string, productId: string) {
    const product = await this.productsService.findOne(productId);
    const activeBusinessIds = await this.activeBusinessIdsForAccount(accountId);
    if (!activeBusinessIds.includes(String(product.businessId))) {
      throw new ForbiddenException({ error: 'place_not_claimed' });
    }
    await this.productsService.remove(productId);
    return { ok: true };
  }

  private async assertOwnsProduct(accountId: string, productId: string): Promise<void> {
    const product = await this.productsService.findOne(productId);
    const activeBusinessIds = await this.activeBusinessIdsForAccount(accountId);
    if (!activeBusinessIds.includes(String(product.businessId))) {
      throw new ForbiddenException({ error: 'place_not_claimed' });
    }
  }

  async listOwnDiscounts(accountId: string, productId: string) {
    await this.assertOwnsProduct(accountId, productId);
    return this.discountsService.findAll(productId);
  }

  async createOwnDiscount(accountId: string, dto: CreateDiscountDto) {
    await this.assertOwnsProduct(accountId, dto.productId);
    return this.discountsService.create(dto);
  }

  async updateOwnDiscount(accountId: string, discountId: string, dto: UpdateDiscountDto) {
    const discount = await this.discountsService.findOne(discountId);
    await this.assertOwnsProduct(accountId, String(discount.productId));
    return this.discountsService.update(discountId, dto);
  }

  async expireOwnDiscount(accountId: string, discountId: string) {
    const discount = await this.discountsService.findOne(discountId);
    await this.assertOwnsProduct(accountId, String(discount.productId));
    return this.discountsService.expire(discountId);
  }
}
