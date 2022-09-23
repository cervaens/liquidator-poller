import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IbTokenController } from './ib-token.controller';
import { IBtoken, IBtokenSchema } from './ib-token.schema';
import { IbTokenService } from './ib-token.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: IBtoken.name, schema: IBtokenSchema }]),
  ],
  controllers: [IbTokenController],
  providers: [IbTokenService],
  exports: [IbTokenService],
})
export class IbTokenModule {}
