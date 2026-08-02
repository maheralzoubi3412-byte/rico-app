import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusinessAccount, BusinessAccountSchema } from './schemas/business-account.schema';
import { MagicLinkToken, MagicLinkTokenSchema } from './schemas/magic-link-token.schema';
import { BusinessClaim, BusinessClaimSchema } from './schemas/business-claim.schema';
import { BusinessAuthService } from './business-auth.service';
import { BusinessAuthController } from './business-auth.controller';
import { BusinessesModule } from '../businesses/businesses.module';
import { DealsModule } from '../deals/deals.module';
import { ProductsModule } from '../products/products.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { MailerModule } from '../mailer/mailer.module';
import { loginIpLimiter, loginEmailLimiter } from '../common/middleware/rate-limiters';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BusinessAccount.name, schema: BusinessAccountSchema },
      { name: MagicLinkToken.name, schema: MagicLinkTokenSchema },
      { name: BusinessClaim.name, schema: BusinessClaimSchema },
    ]),
    BusinessesModule,
    DealsModule,
    ProductsModule,
    DiscountsModule,
    MailerModule,
  ],
  controllers: [BusinessAuthController],
  providers: [BusinessAuthService],
  exports: [MongooseModule, BusinessAuthService],
})
export class BusinessAuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(loginIpLimiter, loginEmailLimiter).forRoutes({ path: 'business/login', method: RequestMethod.POST });
  }
}
