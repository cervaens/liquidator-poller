import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CtokenController } from './ctoken.controller';
import { CtokenService } from './ctoken.service';
import { Ctoken, CtokenSchema } from './ctoken.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ctoken.name, schema: CtokenSchema }]),
  ],
  controllers: [CtokenController],
  providers: [CtokenService, CtokenController],
  exports: [CtokenController],
})
export class CtokensModule {}
