import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Controller, Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';
// import { IbControlService } from 'src/mongodb/ib-control/ib-control.service';
import { IbTokenService } from 'src/mongodb/ib-token/ib-token.service';
import { IronbankPricesService } from '../ironbank-prices/ironbank-prices.service';
import { IronbankPollerService } from './ironbank-poller.service';

@Controller('ironbank-poller')
export class IronbankPollerController {
  constructor(
    private readonly ibPollerService: IronbankPollerService,
    private readonly ibTokenService: IbTokenService,
    private readonly appService: AppService,
    private readonly amqpConnection: AmqpConnection,
    private readonly ironBankPrices: IronbankPricesService,
  ) {}

  // private tokens: Record<string, any>;
  private readonly logger = new Logger(IronbankPollerController.name);

  async onApplicationBootstrap(): Promise<void> {
    let amITheMaster = false;
    await this.ibPollerService.initTokenContracts();

    setInterval(() => {
      if (
        amITheMaster
        // !this.ibControlService.updatingMarkets
      ) {
        this.pollAccounts();
      }
    }, parseInt(process.env.IRONBANK_POLL_BALANCES_PERIOD));

    setInterval(() => {
      if (
        amITheMaster
        // !this.ibControlService.updatingMarkets
      ) {
        this.pollIBTokens();
      }
    }, parseInt(process.env.IRONBANK_POLL_TOKENS_PERIOD));

    this.logger.debug('Waiting to listen from other workers...');
    setInterval(async () => {
      if (this.appService.amItheMaster() && !amITheMaster) {
        this.ibPollerService.getAccountsFromUnitroller();
        const tokens = await this.pollIBTokens();
        await this.ironBankPrices.getTokensUnderlyingPrice(tokens);
        this.pollAccounts();
        amITheMaster = true;
        this.appService.setControlIdStatus('IB-poller-init-finished', true);
      } else if (!this.appService.amItheMaster() && amITheMaster) {
        // unsubscribe if for some reason stops being master
        this.ibPollerService.unsubscribeWs();
        amITheMaster = false;
        this.appService.setControlIdStatus('IB-poller-init-finished', false);
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));
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
