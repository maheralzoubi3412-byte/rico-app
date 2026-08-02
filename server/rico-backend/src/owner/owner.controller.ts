import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { OwnerAuthService } from '../owner-auth/owner-auth.service';
import { OwnerAuditService } from '../owner-audit/owner-audit.service';
import { AdminService } from '../admin/admin.service';
import { OwnerLoginDto } from '../owner-auth/dto/owner-login.dto';
import { CreateStaffDto } from '../owner-auth/dto/create-staff.dto';
import { UpdateStaffDto } from '../owner-auth/dto/update-staff.dto';
import { OwnerSessionGuard } from '../common/guards/owner-session.guard';
import { OwnerOnlyGuard } from '../common/guards/owner-only.guard';
import { OwnerId } from '../common/decorators/owner-id.decorator';
import { ListAdminBusinessesDto } from '../admin/dto/list-admin-businesses.dto';
import { ListAdminAccountsDto } from '../admin/dto/list-admin-accounts.dto';
import { SetActiveDto } from '../admin/dto/set-active.dto';
import { ReviewClaimStatusDto } from '../admin/dto/review-status.dto';
import { BusinessImpressionsQueryDto } from '../admin/dto/business-impressions-query.dto';
import { TopVendorsQueryDto } from '../admin/dto/top-vendors-query.dto';
import { ExpiringDealsQueryDto } from '../admin/dto/expiring-deals-query.dto';
import { ListAuditLogDto } from '../owner-audit/dto/list-audit-log.dto';

@Controller('owner')
export class OwnerController {
  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly ownerAuditService: OwnerAuditService,
    private readonly adminService: AdminService,
  ) {}

  @Post('login')
  async login(@Body() dto: OwnerLoginDto, @Req() req: Request) {
    const { ownerId, role } = await this.ownerAuthService.login(dto.email, dto.password);

    // Regenerate the session on login (prevents session fixation) before
    // setting the authenticated ownerId — same pattern as business login.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.ownerId = ownerId;
    req.session.ownerRole = role;

    return this.ownerAuthService.me(ownerId);
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy(() => res.json({ ok: true }));
  }

  @UseGuards(OwnerSessionGuard)
  @Get('me')
  me(@OwnerId() ownerId: string) {
    return this.ownerAuthService.me(ownerId);
  }

  @UseGuards(OwnerOnlyGuard)
  @Get('staff')
  listStaff() {
    return this.ownerAuthService.listStaff();
  }

  @UseGuards(OwnerOnlyGuard)
  @Post('staff')
  async createStaff(@Body() dto: CreateStaffDto, @OwnerId() ownerId: string) {
    const created = await this.ownerAuthService.createStaff(dto.email, dto.password, dto.role);
    await this.recordAudit(ownerId, 'staff.create', 'OwnerAccount', String(created.id), { email: created.email, role: created.role });
    return created;
  }

  @UseGuards(OwnerOnlyGuard)
  @Patch('staff/:id')
  async updateStaff(@Param('id') id: string, @Body() dto: UpdateStaffDto, @OwnerId() ownerId: string) {
    const updated = await this.ownerAuthService.updateStaff(ownerId, id, dto);
    await this.recordAudit(ownerId, 'staff.update', 'OwnerAccount', id, dto as Record<string, unknown>);
    return updated;
  }

  @UseGuards(OwnerSessionGuard)
  @Get('businesses')
  listBusinesses(@Query() query: ListAdminBusinessesDto) {
    return this.adminService.listBusinesses(query);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('businesses/export')
  async exportBusinesses(@Res() res: Response) {
    const csv = await this.adminService.exportBusinessesCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="businesses.csv"');
    res.send(csv);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('businesses/:id')
  getBusinessDetail(@Param('id') id: string) {
    return this.adminService.getBusinessDetail(id);
  }

  @UseGuards(OwnerSessionGuard)
  @Patch('businesses/:id/active')
  async setBusinessActive(@Param('id') id: string, @Body() dto: SetActiveDto, @OwnerId() ownerId: string) {
    const result = await this.adminService.setBusinessActive(id, dto.isActive);
    await this.recordAudit(ownerId, 'business.setActive', 'Business', id, { isActive: dto.isActive });
    return result;
  }

  @UseGuards(OwnerSessionGuard)
  @Get('businesses/:id/impressions')
  getBusinessImpressions(@Param('id') id: string, @Query() query: BusinessImpressionsQueryDto) {
    return this.adminService.getBusinessImpressions(id, query.days ?? 30);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('accounts')
  listAccounts(@Query() query: ListAdminAccountsDto) {
    return this.adminService.listAccounts(query);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('accounts/export')
  async exportAccounts(@Res() res: Response) {
    const csv = await this.adminService.exportAccountsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="accounts.csv"');
    res.send(csv);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('accounts/:id')
  getAccountDetail(@Param('id') id: string) {
    return this.adminService.getAccountDetail(id);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @UseGuards(OwnerSessionGuard)
  @Get('analytics/top-vendors')
  getTopVendors(@Query() query: TopVendorsQueryDto) {
    return this.adminService.getTopVendors(query.days ?? 30, query.limit ?? 10);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('analytics/expiring-deals')
  getExpiringDeals(@Query() query: ExpiringDealsQueryDto) {
    return this.adminService.getExpiringDeals(query.days ?? 7);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('analytics/deal-type-performance')
  getDealTypePerformance(@Query() query: BusinessImpressionsQueryDto) {
    return this.adminService.getDealTypePerformance(query.days ?? 30);
  }

  @UseGuards(OwnerSessionGuard)
  @Get('analytics/search-gaps')
  getSearchGaps(@Query() query: BusinessImpressionsQueryDto) {
    return this.adminService.getSearchGaps(query.days ?? 30);
  }

  @UseGuards(OwnerSessionGuard)
  @Patch('claims/:id/status')
  async reviewClaimStatus(@Param('id') id: string, @Body() dto: ReviewClaimStatusDto, @OwnerId() ownerId: string) {
    const result = await this.adminService.reviewClaimStatus(id, dto.status);
    await this.recordAudit(ownerId, 'claim.review', 'BusinessClaim', id, { status: dto.status });
    return result;
  }

  @UseGuards(OwnerSessionGuard)
  @Get('audit-log')
  listAuditLog(@Query() query: ListAuditLogDto) {
    return this.ownerAuditService.list(query.page ?? 1, query.limit ?? 30);
  }

  private async recordAudit(
    ownerId: string,
    action: string,
    targetType: string,
    targetId: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    const { email } = await this.ownerAuthService.me(ownerId);
    await this.ownerAuditService.record({ ownerId, ownerEmail: email, action, targetType, targetId, detail });
  }
}
