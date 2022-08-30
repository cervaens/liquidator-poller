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

  private tokens = [];
  async onApplicationBootstrap(): Promise<void> {
    const tokenUAddresses = await this.pollCTokens();
    await this.pollCethWalletBalance();
    this.compoundPrices.pollAndStorePrices(tokenUAddresses);

    // At init the master will start a poll
    this.logger.debug('Waiting to listen from other workers...');
    setTimeout(() => {
      if (this.appService.amItheMaster()) {
        this.pollAccounts(true);
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));

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

    setInterval(() => {
      if (this.appService.amItheMaster()) {
        this.pollCethWalletBalance();
      }
    }, parseInt(process.env.COMPOUND_POLLING_SCHEDULE_CETH_WALLET_BALANCE));
  }

  private readonly logger = new Logger(CompoundPollerController.name);
  async pollCTokens() {
    this.logger.debug('Calling Ctokens endpoint');
    this.tokens = (await this.compoundPollerService.fetchCtokens({})).tokens;
    await this.ctokenController.createMany(this.tokens);
    return this.tokens.map((token: CompoundToken) => ({
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

  async pollCethWalletBalance() {
    this.logger.debug('Checking cETH wallet balance');
    const cEth = this.tokens.filter((token) => token.symbol === 'cETH');
    this.amqpConnection.publish(
      'liquidator-exchange',
      'get-token-wallet-balance',
      {
        token: cEth[0].symbol,
        tokenAddress: cEth[0].address,
      },
    );
  }
}
