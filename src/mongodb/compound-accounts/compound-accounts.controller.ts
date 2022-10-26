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
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS) + 1000);
  }
}
