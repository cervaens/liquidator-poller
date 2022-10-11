import { Module } from '@nestjs/common';
import { IronbankPollerModule } from './ironbank-poller/ironbank-poller.module';
import { IronbankPricesModule } from './ironbank-prices/ironbank-prices.module';

@Module({
  imports: [IronbankPollerModule, IronbankPricesModule],
})
export class IronbankModule {}
