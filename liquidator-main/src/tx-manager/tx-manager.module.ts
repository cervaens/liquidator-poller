import { Module } from '@nestjs/common';
import { TxManagerController } from './tx-manager.controller';
import { TxManagerService } from './tx-manager.service';

@Module({
  controllers: [TxManagerController],
  providers: [TxManagerService]
})
export class TxManagerModule {}
