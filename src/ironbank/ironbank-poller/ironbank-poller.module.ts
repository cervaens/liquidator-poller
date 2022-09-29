import { Module } from '@nestjs/common';
import { IronbankPricesModule } from '../ironbank-prices/ironbank-prices.module';
import { IronbankPollerController } from './ironbank-poller.controller';
import { IronbankPollerService } from './ironbank-poller.service';

@Module({
  imports: [IronbankPricesModule],
  controllers: [IronbankPollerController],
  providers: [IronbankPollerService],
  // exports: [IronbankPollerService],
})
export class IronbankPollerModule {}
