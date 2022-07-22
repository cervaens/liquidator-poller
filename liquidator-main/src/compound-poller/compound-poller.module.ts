import { Module } from '@nestjs/common';
import { CompoundPricesWsService } from 'src/compound-prices-ws/compound-prices-ws.service';
import { CompoundPollerController } from './compound-poller.controller';
import { CompoundPollerService } from './compound-poller.service';
import { CompoundPricesWsHelperService } from 'src/compound-prices-ws-helper/compound-prices-ws-helper.service';

@Module({
  imports: [],
  providers: [
    CompoundPollerService,
    CompoundPricesWsService,
    CompoundPricesWsHelperService,
  ],
  controllers: [CompoundPollerController],
  exports: [],
})
export class CompoundPollerModule {}
