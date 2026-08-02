import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { OwnerController } from './owner.controller';
import { OwnerAuthModule } from '../owner-auth/owner-auth.module';
import { OwnerAuditModule } from '../owner-audit/owner-audit.module';
import { AdminModule } from '../admin/admin.module';
import { loginIpLimiter, loginEmailLimiter } from '../common/middleware/rate-limiters';

@Module({
  imports: [OwnerAuthModule, OwnerAuditModule, AdminModule],
  controllers: [OwnerController],
})
export class OwnerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(loginIpLimiter, loginEmailLimiter).forRoutes({ path: 'owner/login', method: RequestMethod.POST });
  }
}
