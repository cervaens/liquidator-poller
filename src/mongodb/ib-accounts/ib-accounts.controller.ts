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
    this.logger.debug('Waiting to listen from other workers...');
    setTimeout(async () => {
      if (this.appService.amItheMaster()) {
        this.ibAccountsService.sendLiquidationStatus();
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));

    setInterval(async () => {
      if (
        this.appService.amItheMaster() &&
        Object.keys(this.ibAccountsService.allActiveCandidates).length !== 0
      ) {
        this.ibAccountsService.getCandidatesFromDB();
      }
    }, 120000);
  }
}
