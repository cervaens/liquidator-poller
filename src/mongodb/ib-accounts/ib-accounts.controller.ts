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
    setTimeout(() => {
      if (this.appService.amItheMaster()) {
        this.ibAccountsService.sendLiquidationStatus();
      }
      // At startup allActiveCandidates list will be empty after WAIT_TIME
      // so only the master will get the candidates from DB
      // versus if there's a list already then any new pod will load the candidates list
      if (
        Object.keys(this.ibAccountsService.allActiveCandidates).length !== 0 ||
        this.appService.amItheMaster()
      ) {
        this.ibAccountsService.getCandidatesFromDB();
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS) + 1000);
  }
}
