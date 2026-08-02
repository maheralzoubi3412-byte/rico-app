import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessAuthService } from './business-auth.service';
import { LoginDto } from './dto/login.dto';
import { ClaimBusinessDto } from './dto/claim-business.dto';
import { CreateOwnDealDto } from './dto/create-own-deal.dto';
import { UpdateOwnDealDto } from './dto/update-own-deal.dto';
import { BusinessSessionGuard } from '../common/guards/business-session.guard';
import { BusinessId } from '../common/decorators/business-id.decorator';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { CreateDiscountDto } from '../discounts/dto/create-discount.dto';
import { UpdateDiscountDto } from '../discounts/dto/update-discount.dto';

@Controller('business')
export class BusinessAuthController {
  constructor(private readonly businessAuthService: BusinessAuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.businessAuthService.login(dto.email, baseUrl);
  }

  // Redirects only to a fixed internal path — never a client-supplied target.
  @Get('verify')
  async verify(@Query('token') token: string, @Req() req: Request, @Res() res: Response) {
    let result: { businessId: string };
    try {
      result = await this.businessAuthService.verify(token);
    } catch {
      return res.status(400).send('رابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.');
    }

    // Regenerate the session on login (prevents session fixation) before
    // setting the authenticated businessId.
    req.session.regenerate((err) => {
      if (err) return res.status(500).send('حدث خطأ، حاول مرة أخرى.');
      req.session.businessId = result.businessId;
      res.redirect('/business/dashboard');
    });
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  }

  @UseGuards(BusinessSessionGuard)
  @Get('me')
  me(@BusinessId() businessId: string) {
    return this.businessAuthService.me(businessId);
  }

  @UseGuards(BusinessSessionGuard)
  @Post('claim-place')
  claimPlace(@BusinessId() businessId: string, @Body() dto: ClaimBusinessDto) {
    return this.businessAuthService.claimBusiness(businessId, dto.businessId);
  }

  @UseGuards(BusinessSessionGuard)
  @Get('deals')
  listDeals(@BusinessId() businessId: string) {
    return this.businessAuthService.listOwnDeals(businessId);
  }

  @UseGuards(BusinessSessionGuard)
  @Post('deals')
  createDeal(@BusinessId() businessId: string, @Body() dto: CreateOwnDealDto) {
    return this.businessAuthService.createOwnDeal(businessId, dto);
  }

  @UseGuards(BusinessSessionGuard)
  @Patch('deals/:id')
  updateDeal(@BusinessId() businessId: string, @Param('id') dealId: string, @Body() dto: UpdateOwnDealDto) {
    return this.businessAuthService.updateOwnDeal(businessId, dealId, dto);
  }

  @UseGuards(BusinessSessionGuard)
  @Get('products')
  listProducts(@BusinessId() accountId: string, @Query('businessId') businessId: string) {
    return this.businessAuthService.listOwnProducts(accountId, businessId);
  }

  @UseGuards(BusinessSessionGuard)
  @Post('products')
  createProduct(@BusinessId() accountId: string, @Body() dto: CreateProductDto) {
    return this.businessAuthService.createOwnProduct(accountId, dto);
  }

  @UseGuards(BusinessSessionGuard)
  @Patch('products/:id')
  updateProduct(@BusinessId() accountId: string, @Param('id') productId: string, @Body() dto: UpdateProductDto) {
    return this.businessAuthService.updateOwnProduct(accountId, productId, dto);
  }

  @UseGuards(BusinessSessionGuard)
  @Delete('products/:id')
  removeProduct(@BusinessId() accountId: string, @Param('id') productId: string) {
    return this.businessAuthService.removeOwnProduct(accountId, productId);
  }

  @UseGuards(BusinessSessionGuard)
  @Get('discounts')
  listDiscounts(@BusinessId() accountId: string, @Query('productId') productId: string) {
    return this.businessAuthService.listOwnDiscounts(accountId, productId);
  }

  @UseGuards(BusinessSessionGuard)
  @Post('discounts')
  createDiscount(@BusinessId() accountId: string, @Body() dto: CreateDiscountDto) {
    return this.businessAuthService.createOwnDiscount(accountId, dto);
  }

  @UseGuards(BusinessSessionGuard)
  @Patch('discounts/:id')
  updateDiscount(@BusinessId() accountId: string, @Param('id') discountId: string, @Body() dto: UpdateDiscountDto) {
    return this.businessAuthService.updateOwnDiscount(accountId, discountId, dto);
  }

  @UseGuards(BusinessSessionGuard)
  @Patch('discounts/:id/expire')
  expireDiscount(@BusinessId() accountId: string, @Param('id') discountId: string) {
    return this.businessAuthService.expireOwnDiscount(accountId, discountId);
  }
}
