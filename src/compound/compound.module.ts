import { Module } from '@nestjs/common';
import { CompoundPollerModule } from './compound-poller/compound-poller.module';

@Module({
  imports: [CompoundPollerModule],
  controllers: [],
  providers: [CompoundPollerModule],
})
export class CompoundModule {}
