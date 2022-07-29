import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Controller, Inject, Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';

import { CompoundAccountsService } from './compound-accounts.service';
// import CtokenDto from './dto/create-ctoken.dto';

@Controller('compound-accounts')
export class CompoundAccountsController {
  constructor(
    private readonly compoundAccountsService: CompoundAccountsService,
    private readonly amqpConnection: AmqpConnection,
    @Inject(AppService) private appService: AppService,
  ) {}
  private readonly logger = new Logger(CompoundAccountsController.name);
  private candidatesTimeout =
    parseInt(process.env.PERIOD_CLEAN_CANDIDATES) || 4000;

  async onApplicationBootstrap(): Promise<void> {
    // Cleaning all candidates list as some workers might have disconnected
    // or some candidates are not anymore
    setInterval(() => {
      // Have to comment the following as if its the master going down
      // it will take sometime before other worker becomes master
      // if (this.appService.amItheMaster()) {
      const timestamp = new Date().getTime() - this.candidatesTimeout;
      this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
        action: 'deleteBelowTimestamp',
        timestamp,
      });
      // }
    }, this.candidatesTimeout);
  }
}
