import { Controller, Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly appService: AppService,
    private readonly walletService: WalletService,
  ) {}

  // private tokens: Record<string, any>;
  private readonly logger = new Logger(WalletController.name);

  async onApplicationBootstrap(): Promise<void> {
    setInterval(async () => {
      if (this.appService.amItheMaster()) {
        this.logger.debug('Rebasing wallet nonce');
        this.walletService.rebase();
      }
    }, 60000);
  }
}
