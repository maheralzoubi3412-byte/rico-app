import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { BusinessesModule } from './businesses/businesses.module';
import { ProductsModule } from './products/products.module';
import { DiscountsModule } from './discounts/discounts.module';
import { PricingModule } from './pricing/pricing.module';
import { DealsModule } from './deals/deals.module';
import { SearchModule } from './search/search.module';
import { ClassifyModule } from './classify/classify.module';
import { BusinessAuthModule } from './business-auth/business-auth.module';
import { AdminModule } from './admin/admin.module';
import { OwnerModule } from './owner/owner.module';
import { PublicModule } from './public/public.module';
import { MailerModule } from './mailer/mailer.module';
import { SpaModule } from './spa/spa.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    // Static client assets (client/dist) — SPA page routes are handled
    // separately by SpaModule/SpaController since ServeStaticModule can't
    // fall back to index.html for unmatched routes on its own.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client', 'dist'),
      exclude: [
        '/search*',
        '/search/products*',
        '/deals*',
        '/classify*',
        '/places/search*',
        '/submit-deal*',
        '/impressions*',
        '/search-gaps*',
        '/businesses*',
        '/products*',
        '/discounts*',
        '/admin*',
        '/business*',
        '/owner*',
      ],
    }),
    BusinessesModule,
    ProductsModule,
    DiscountsModule,
    PricingModule,
    DealsModule,
    SearchModule,
    ClassifyModule,
    MailerModule,
    BusinessAuthModule,
    AdminModule,
    OwnerModule,
    PublicModule,
    SpaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
