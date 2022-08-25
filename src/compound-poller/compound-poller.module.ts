import { Module } from '@nestjs/common';
import { CompoundPricesWsService } from 'src/compound-prices-ws/compound-prices-ws.service';
import { CompoundPollerController } from './compound-poller.controller';
import { CompoundPollerService } from './compound-poller.service';
import { CompoundPricesWsHelperService } from 'src/compound-prices-ws-helper/compound-prices-ws-helper.service';
import { CompoundPricesWsController } from 'src/compound-prices-ws/compound-prices-ws.controller';

@Module({
  imports: [],
  providers: [
    CompoundPollerService,
    CompoundPricesWsService,
    CompoundPricesWsHelperService,
  ],
  controllers: [CompoundPollerController, CompoundPricesWsController],
  exports: [],
})
export class CompoundPollerModule {}
