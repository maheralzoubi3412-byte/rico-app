import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OwnerAccount, OwnerAccountSchema } from './schemas/owner-account.schema';
import { OwnerAuthService } from './owner-auth.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: OwnerAccount.name, schema: OwnerAccountSchema }])],
  providers: [OwnerAuthService],
  exports: [MongooseModule, OwnerAuthService],
})
export class OwnerAuthModule {}
