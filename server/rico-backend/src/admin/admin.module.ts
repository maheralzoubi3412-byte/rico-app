import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiUsage, ApiUsageSchema } from './schemas/api-usage.schema';
import { SyncLog, SyncLogSchema } from './schemas/sync-log.schema';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BusinessesModule } from '../businesses/businesses.module';
import { DealsModule } from '../deals/deals.module';
import { BusinessAuthModule } from '../business-auth/business-auth.module';
import { ProductsModule } from '../products/products.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ApiUsage.name, schema: ApiUsageSchema },
      { name: SyncLog.name, schema: SyncLogSchema },
    ]),
    BusinessesModule,
    DealsModule,
    BusinessAuthModule,
    ProductsModule,
    DiscountsModule,
    PublicModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
