import { Module } from '@nestjs/common';
import { IronbankPollerController } from './ironbank-poller.controller';
import { IronbankPollerService } from './ironbank-poller.service';

@Module({
  controllers: [IronbankPollerController],
  providers: [IronbankPollerService],
  exports: [IronbankPollerService],
})
export class IronbankPollerModule {}
