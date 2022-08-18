import { Controller, Inject, Logger } from '@nestjs/common';
import { CompoundPollerService } from './compound-poller.service';
import { CtokenController } from '../mongodb/ctoken/ctoken.controller';
import { CompoundToken } from '../mongodb/ctoken/classes/CompoundToken';
import { CompoundPricesWsService } from '../compound-prices-ws/compound-prices-ws.service';
import { AppService } from 'src/app.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
@Controller('compound-poller')
export class CompoundPollerController {
  constructor(
    private readonly compoundPollerService: CompoundPollerService,
    private readonly ctokenController: CtokenController,
    private readonly compoundPrices: CompoundPricesWsService,
    @Inject(AppService) private appService: AppService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const tokenUAddresses = await this.pollCTokens();
    this.compoundPrices.pollAndStorePrices(tokenUAddresses);

    // At init the master will start a poll
    if (this.appService.amItheMaster()) {
      this.pollAccounts(true);
    }
    // Dont start a poll, jst set the allCandidates list to zero,
    // so that all are "new" in the next poll
    // This logic will go to app.controller as worker-joining
    // this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
    //   action: 'deleteBelowTimestamp',
    //   timestamp: new Date().getTime(),
    // });
    //   }
    // }, 5500);

    setInterval(() => {
      if (this.appService.amItheMaster()) {
        this.pollCTokens();
      }
    }, parseInt(process.env.COMPOUND_POLLING_SCHEDULE_CTOKENS));

    setInterval(() => {
      if (
        this.appService.amItheMaster() &&
        !this.compoundPollerService.isInitOngoing()
      ) {
        this.pollAccounts();
      }
    }, parseInt(process.env.COMPOUND_POLLING_SCHEDULE_ACCOUNTS));
  }

  private readonly logger = new Logger(CompoundPollerController.name);
  async pollCTokens() {
    this.logger.debug('Calling Ctokens endpoint');
    const { tokens }: Record<string, any> =
      await this.compoundPollerService.fetchCtokens({});
    await this.ctokenController.createMany(tokens);
    return tokens.map((token: CompoundToken) => ({
      underlyingAddress: token.underlyingAddress,
      underlyingSymbol: token.underlyingSymbol,
    }));
  }

  async pollAccounts(init = false) {
    this.logger.debug('Calling Accounts endpoint');
    this.amqpConnection.publish('liquidator-exchange', 'fetch-accounts', {
      init,
    });
  }
}
