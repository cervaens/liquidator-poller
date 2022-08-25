import { Module } from '@nestjs/common';
import { TxManagerController } from './tx-manager.controller';
import { TxManagerService } from './tx-manager.service';
import { WalletService } from './wallet/wallet.service';

@Module({
  controllers: [TxManagerController],
  providers: [TxManagerService, WalletService, WalletService],
})
export class TxManagerModule {}
