import { Controller, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CompoundPollerService } from './compound-poller.service';
import { CtokenController } from '../mongodb/ctoken/ctoken.controller';

@Controller('compound-poller')
export class CompoundPollerController {
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly compoundPollerService: CompoundPollerService,
    private readonly ctokenController: CtokenController,
  ) {}

  async onModuleInit(): Promise<void> {
    this.pollCTokens();
    this.pollAccounts();
    setInterval(
      () => this.pollCTokens(),
      parseInt(process.env.COMPOUND_POLLING_SCHEDULE_CTOKENS),
    );

    setInterval(
      () => this.pollAccounts(),
      parseInt(process.env.COMPOUND_POLLING_SCHEDULE_ACCOUNTS),
    );
  }

  private readonly logger = new Logger(CompoundPollerController.name);
  async pollCTokens() {
    this.logger.debug('Calling Ctokens endpoint');
    const { tokens }: Record<string, any> =
      await this.compoundPollerService.fetchCtokens({});
    await this.ctokenController.createMany(tokens);
    return true;
  }

  async pollAccounts() {
    this.logger.debug('Calling Accounts endpoint');

    await this.compoundPollerService.fetchAccounts();
    // await this.ctokenController.createMany(tokens);
    return true;
  }

  async sendTestMsg() {
    return true;
  }
}
