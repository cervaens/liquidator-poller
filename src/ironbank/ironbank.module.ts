import { Module } from '@nestjs/common';
import { IronbankPollerModule } from './ironbank-poller/ironbank-poller.module';

@Module({
  imports: [IronbankPollerModule],
})
export class IronbankModule {}
