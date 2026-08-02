import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import cors from 'cors';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { BusinessesModule } from '../businesses/businesses.module';
import { DealsModule } from '../deals/deals.module';
import { VendorImpression, VendorImpressionSchema } from './schemas/vendor-impression.schema';
import { SearchGap, SearchGapSchema } from './schemas/search-gap.schema';
import { submitDealLimiter, impressionLimiter } from '../common/middleware/rate-limiters';

@Module({
  imports: [
    BusinessesModule,
    DealsModule,
    MongooseModule.forFeature([
      { name: VendorImpression.name, schema: VendorImpressionSchema },
      { name: SearchGap.name, schema: SearchGapSchema },
    ]),
  ],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [MongooseModule],
})
export class PublicModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cors()).forRoutes(
      { path: 'places/search', method: RequestMethod.GET },
      { path: 'submit-deal', method: RequestMethod.POST },
      { path: 'impressions', method: RequestMethod.POST },
      { path: 'search-gaps', method: RequestMethod.POST },
    );
    consumer.apply(submitDealLimiter).forRoutes({ path: 'submit-deal', method: RequestMethod.POST });
    consumer.apply(impressionLimiter).forRoutes(
      { path: 'impressions', method: RequestMethod.POST },
      { path: 'search-gaps', method: RequestMethod.POST },
    );
  }
}
