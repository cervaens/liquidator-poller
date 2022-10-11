import { Controller, Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';
import { IbAccountsService } from './ib-accounts.service';

@Controller('ib-accounts')
export class IbAccountsController {
  constructor(
    private readonly ibAccountsService: IbAccountsService,
    private readonly appService: AppService,
  ) {}
  private readonly logger = new Logger(IbAccountsController.name);

  async onApplicationBootstrap(): Promise<void> {
    // At init the master will start a poll
    this.logger.debug('Waiting to listen from other workers...');
    setTimeout(async () => {
      if (this.appService.amItheMaster()) {
        this.ibAccountsService.getCandidatesFromDB();
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS) + 1000);
  }

  async accountEntersMarket(
    account: string,
    market: string,
    blockNumber: number,
  ) {
    return await this.ibAccountsService.accountEntersMarket(
      account,
      market,
      blockNumber,
    );
  }

  async accountExitsMarket(
    account: string,
    market: string,
    blockNumber: number,
  ) {
    return await this.ibAccountsService.accountExitsMarket(
      account,
      market,
      blockNumber,
    );
  }
}