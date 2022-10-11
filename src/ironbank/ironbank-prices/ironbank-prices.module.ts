import { Module } from '@nestjs/common';
import { IronbankPricesService } from './ironbank-prices.service';
import { IronbankPricesController } from './ironbank-prices.controller';
// import { IronbankPollerModule } from '../ironbank-poller/ironbank-poller.module';

@Module({
  providers: [IronbankPricesService],
  controllers: [IronbankPricesController],
  exports: [IronbankPricesService],
})
export class IronbankPricesModule {}
