import { Controller, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CompoundPollerService } from './compound-poller.service';
import { CtokenController } from '../mongodb/ctoken/ctoken.controller';
import { CompoundToken } from '../mongodb/ctoken/classes/CompoundToken';
import { CompoundPricesWsService } from '../compound-prices-ws/compound-prices-ws.service';
@Controller('compound-poller')
export class CompoundPollerController {
  constructor(
    private readonly compoundPollerService: CompoundPollerService,
    private readonly ctokenController: CtokenController,
    private readonly compoundPrices: CompoundPricesWsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const tokenSymbols = await this.pollCTokens();
    await this.compoundPrices.pollAndStorePrices([
      ...new Set(tokenSymbols),
    ] as Array<string>);

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
    return tokens.map((token: CompoundToken) => token.underlyingSymbol);
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
