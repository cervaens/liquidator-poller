import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBasicAuth, ApiOperation } from '@nestjs/swagger';
import { BlockNumberDto } from 'src/app.dto';
import { AppService } from 'src/app.service';
import { ACLGuard } from 'src/auth/acl.guard';
import { IbAccountsService } from 'src/mongodb/ib-accounts/ib-accounts.service';
// import { IbControlService } from 'src/mongodb/ib-control/ib-control.service';
import { IbTokenService } from 'src/mongodb/ib-token/ib-token.service';
import { IronbankPricesService } from '../ironbank-prices/ironbank-prices.service';
import { IronbankPollerService } from './ironbank-poller.service';

@ApiBasicAuth()
@Controller('ironbank-poller')
export class IronbankPollerController {
  constructor(
    private readonly ibPollerService: IronbankPollerService,
    private readonly ibTokenService: IbTokenService,
    private readonly appService: AppService,
    private readonly amqpConnection: AmqpConnection,
    private readonly ironBankPrices: IronbankPricesService,
    private readonly ibAccountsService: IbAccountsService,
  ) {}

  // private tokens: Record<string, any>;
  private readonly logger = new Logger(IronbankPollerController.name);

  async onApplicationBootstrap(): Promise<void> {
    let amITheMaster = false;

    setTimeout(async () => {
      const tokens = await this.pollIBTokens();
      await this.ironBankPrices.getTokensUnderlyingPrice({
        tokens,
        init: true,
      });
      this.appService.setControlIdStatus('IB-poller-init-finished', true);
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));

    this.logger.debug('Waiting to listen from other workers...');
    setInterval(async () => {
      if (this.appService.amItheMaster() && !amITheMaster) {
        amITheMaster = true;
        this.ibPollerService.getAccountsFromUnitroller(null);
        this.ibAccountsService.sendLiquidationStatus();
      } else if (!this.appService.amItheMaster() && amITheMaster) {
        amITheMaster = false;
        // unsubscribe if for some reason stops being master
        this.ibPollerService.unsubscribeWs();
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));

    setInterval(() => {
      if (amITheMaster) {
        this.pollAccounts();
      }
    }, parseInt(process.env.IRONBANK_POLL_BALANCES_PERIOD));

    setInterval(() => {
      if (amITheMaster) {
        this.pollIBTokens();
      }
    }, parseInt(process.env.IRONBANK_POLL_TOKENS_PERIOD));
  }

  @ApiOperation({
    description: `Adds an account from a specific protocol to the liquidations blacklist. The account won't be liquidated till it is manually unblacklisted`,
  })
  @Post('reload-accounts-assets/')
  @UseGuards(ACLGuard)
  blackListAccount(@Body() body: BlockNumberDto): string {
    if (!body || !body.blockNumber) {
      return 'Please include the first blocknumber.';
    }
    this.ibPollerService.getAccountsFromUnitroller(body.blockNumber);

    return `Started checking blockchain logs from block number ${body.blockNumber}`;
  }

  async pollAccounts() {
    this.amqpConnection.publish('liquidator-exchange', 'fetch-ib-accounts', {});
  }

  async pollIBTokens() {
    this.logger.debug('Calling IronBank tokens endpoint');
    const tokens = (
      await this.ibPollerService.fetchIBtokens({
        comptroller: 'eth',
      })
    ).tokens;
    this.ibTokenService.createMany(tokens);
    return tokens;
    // return this.tokens.map((token: CompoundToken) => ({
    //   underlyingAddress: token.underlyingAddress,
    //   underlyingSymbol: token.underlyingSymbol,
    // }));
  }
}
