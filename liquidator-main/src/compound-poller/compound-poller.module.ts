import { Module } from '@nestjs/common';
import { CompoundPollerController } from './compound-poller.controller';
import { CompoundPollerService } from './compound-poller.service';

@Module({
  imports: [],
  providers: [CompoundPollerService],
  controllers: [CompoundPollerController],
  exports: [],
})
export class CompoundPollerModule {}
