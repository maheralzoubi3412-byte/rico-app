import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiUsage, ApiUsageSchema } from './schemas/api-usage.schema';
import { SyncLog, SyncLogSchema } from './schemas/sync-log.schema';
import { BusinessClaim, BusinessClaimSchema } from '../vendor/schemas/business-claim.schema';
import { OwnerService } from './owner.service';
import { OwnerController } from './owner.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { OwnerAuditModule } from '../owner-audit/owner-audit.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { DealsModule } from '../deals/deals.module';
import { ProductsModule } from '../products/products.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { PublicModule } from '../public/public.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ApiUsage.name, schema: ApiUsageSchema },
      { name: SyncLog.name, schema: SyncLogSchema },
      { name: BusinessClaim.name, schema: BusinessClaimSchema },
    ]),
    AccountsModule,
    OwnerAuditModule,
    BusinessesModule,
    DealsModule,
    ProductsModule,
    DiscountsModule,
    PublicModule,
    MailerModule,
  ],
  controllers: [OwnerController],
  providers: [OwnerService],
})
export class OwnerModule {}
