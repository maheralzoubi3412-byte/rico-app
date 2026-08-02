import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateBusinessDto } from '../businesses/dto/create-business.dto';
import { CreateDealDto } from '../deals/dto/create-deal.dto';
import { SyncGoogleDto } from './dto/sync-google.dto';
import { ReviewClaimStatusDto, ReviewDealStatusDto } from './dto/review-status.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('places')
  createPlace(@Body() dto: CreateBusinessDto & { sourceId?: string }) {
    return this.adminService.createManualBusiness(dto);
  }

  @Post('deals')
  createDeal(@Body() dto: CreateDealDto) {
    return this.adminService.createManualDeal(dto);
  }

  @Post('sync-google')
  syncGoogle(@Body() dto: SyncGoogleDto) {
    return this.adminService.syncGoogle(dto);
  }

  @Get('usage')
  getUsage() {
    return this.adminService.getUsage();
  }

  @Get('deals/pending')
  getPendingDeals() {
    return this.adminService.getPendingDeals();
  }

  @Patch('deals/:id/status')
  reviewDealStatus(@Param('id') id: string, @Body() dto: ReviewDealStatusDto) {
    return this.adminService.reviewDealStatus(id, dto.status);
  }

  @Get('claims/pending')
  getPendingClaims() {
    return this.adminService.getPendingClaims();
  }

  @Patch('claims/:id/status')
  reviewClaimStatus(@Param('id') id: string, @Body() dto: ReviewClaimStatusDto) {
    return this.adminService.reviewClaimStatus(id, dto.status);
  }
}
