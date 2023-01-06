import { Controller } from '@nestjs/common';
import { AppService } from 'src/app.service';

import { CompoundAccountsService } from './compound-accounts.service';

@Controller('compound-accounts')
export class CompoundAccountsController {
  constructor(
    private readonly compoundAccountsService: CompoundAccountsService,
    private readonly appService: AppService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    setTimeout(async () => {
      this.compoundAccountsService.sendLiquidationStatus();

      // At startup allActiveCandidates list will be empty after WAIT_TIME
      // so only the master will get the candidates from DB
      // versus if there's a list already then any new pod will load the candidates list
      if (
        Object.keys(this.compoundAccountsService.allActiveCandidates).length !==
          0 ||
        this.appService.amItheMaster()
      ) {
        this.compoundAccountsService.getCandidatesFromDB();
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS) + 1000);
  }
}
