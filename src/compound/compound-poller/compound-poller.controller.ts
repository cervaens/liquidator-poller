import { Controller, Get, Inject, Logger, UseGuards } from '@nestjs/common';
import { CompoundPollerService } from './compound-poller.service';
import { CtokenController } from '../../mongodb/ctoken/ctoken.controller';
import { CompoundToken } from '../../mongodb/ctoken/classes/CompoundToken';
import { AppService } from 'src/app.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CompoundPricesWsHelperService } from 'src/compound/compound-prices-ws/compound-prices-ws-helper/compound-prices-ws-helper.service';
import { ApiBasicAuth, ApiOperation } from '@nestjs/swagger';
import { ACLGuard } from 'src/auth/acl.guard';

@ApiBasicAuth()
@Controller('compound-poller')
export class CompoundPollerController {
  constructor(
    private readonly compoundPollerService: CompoundPollerService,
    private readonly ctokenController: CtokenController,
    private readonly compoundPricesHelper: CompoundPricesWsHelperService,
    @Inject(AppService) private appService: AppService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  private tokens = [];
  async onApplicationBootstrap(): Promise<void> {
    // At init the master will start a poll
    this.logger.debug('Waiting to listen from other workers...');

    setTimeout(async () => {
      const tokenUAddresses = await this.pollCTokens();
      await this.compoundPricesHelper.pollAndStorePrices(tokenUAddresses);
      // this.pollCethWalletBalance();
      this.amqpConnection.publish('liquidator-exchange', 'ask-fetch-accounts', {
        init: true,
      });
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));

    setInterval(() => {
      if (this.appService.amItheMaster()) {
        this.pollCTokens();
      }
    }, parseInt(process.env.COMPOUND_POLLING_SCHEDULE_CTOKENS));

    setInterval(() => {
      this.amqpConnection.publish('liquidator-exchange', 'ask-fetch-accounts', {
        init: false,
      });
    }, parseInt(process.env.COMPOUND_POLLING_SCHEDULE_ACCOUNTS));

    // setInterval(() => {
    //   if (this.appService.amItheMaster()) {
    //     this.pollCethWalletBalance();
    //   }
    // }, parseInt(process.env.COMPOUND_POLLING_SCHEDULE_CETH_WALLET_BALANCE));
  }

  private readonly logger = new Logger(CompoundPollerController.name);

  @ApiOperation({
    description: `Poll Compound tokens`,
  })
  @Get('poll-ctokens')
  @UseGuards(ACLGuard)
  async pollCTokens() {
    this.logger.debug('Calling Ctokens endpoint');
    this.tokens = (await this.compoundPollerService.fetchCtokens({})).tokens;
    await this.ctokenController.createMany(this.tokens);
    return this.tokens.map((token: CompoundToken) => ({
      underlyingAddress: token.underlyingAddress,
      underlyingSymbol: token.underlyingSymbol,
    }));
  }

  @ApiOperation({
    description: `Poll Compound accounts`,
  })
  @Get('poll-accounts')
  @UseGuards(ACLGuard)
  async pollAccounts(init = false) {
    this.logger.debug('Calling Accounts endpoint');
    this.amqpConnection.publish('liquidator-exchange', 'fetch-accounts', {
      init,
    });
  }

  async pollCethWalletBalance() {
    this.logger.debug('Checking cETH wallet balance');
    if (this.tokens.length === 0) {
      await this.pollCTokens();
    }
    const cEth = this.tokens.filter((token) => token.symbol === 'cETH');
    if (cEth.length > 0) {
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
}
