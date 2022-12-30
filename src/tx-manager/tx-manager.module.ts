import { Module } from '@nestjs/common';
import { TxManagerController } from './tx-manager.controller';
import { TxManagerService } from './tx-manager.service';
import { WalletService } from './wallet/wallet.service';
import { WalletController } from './wallet/wallet.controller';

@Module({
  controllers: [TxManagerController, WalletController],
  providers: [TxManagerService, WalletService],
})
export class TxManagerModule {}
