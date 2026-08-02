import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import cors from 'cors';
import { ClassifyService } from './classify.service';
import { ClassifyController } from './classify.controller';

@Module({
  controllers: [ClassifyController],
  providers: [ClassifyService],
})
export class ClassifyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cors()).forRoutes({ path: 'classify', method: RequestMethod.POST });
  }
}
