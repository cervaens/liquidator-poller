import { Module } from '@nestjs/common';
import { BlocknativeController } from './blocknative.controller';
import { BlocknativeService } from './blocknative.service';

@Module({
  controllers: [BlocknativeController],
  providers: [BlocknativeService],
})
export class BlocknativeModule {}
