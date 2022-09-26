import { Controller, Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';
import { IbControlService } from 'src/mongodb/ib-control/ib-control.service';
import { IbTokenService } from 'src/mongodb/ib-token/ib-token.service';
import { IronbankPollerService } from './ironbank-poller.service';

@Controller('ironbank-poller')
export class IronbankPollerController {
  constructor(
    private readonly ibPollerService: IronbankPollerService,
    private readonly ibTokenService: IbTokenService,
    private readonly appService: AppService,
    private readonly ibControlService: IbControlService,
  ) {}

  private tokens = [];
  private readonly logger = new Logger(IronbankPollerController.name);

  async onApplicationBootstrap(): Promise<void> {
    await this.pollIBTokens();
    await this.ibPollerService.initTokenContracts();

    setInterval(() => {
      if (
        this.appService.amItheMaster()
        // !this.ibControlService.updatingMarkets
      ) {
        this.ibPollerService.pollAllAccounts();
      }
    }, parseInt(process.env.IRONBANK_POLL_BALANCES_PERIOD));

    let amITheMaster = false;
    setInterval(async () => {
      if (this.appService.amItheMaster() && !amITheMaster) {
        this.ibPollerService.getAccountsFromUnitroller();
        amITheMaster = true;
      } else if (!this.appService.amItheMaster() && amITheMaster) {
        // unsubscribe if for some reason stops being master
        this.ibPollerService.unsubscribeWs();
        amITheMaster = false;
      }
    }, 5500);
  }

  async pollIBTokens() {
    this.logger.debug('Calling IronBank tokens endpoint');
    this.tokens = (
      await this.ibPollerService.fetchIBtokens({ comptroller: 'eth' })
    ).tokens;
    await this.ibTokenService.createMany(this.tokens);
    // return this.tokens.map((token: CompoundToken) => ({
    //   underlyingAddress: token.underlyingAddress,
    //   underlyingSymbol: token.underlyingSymbol,
    // }));
  }

  async pollIBAccountMarkets() {
    this.logger.debug(
      'Getting IronBank Accounts and Market through web3 events',
    );
    this.tokens = (
      await this.ibPollerService.fetchIBtokens({ comptroller: 'eth' })
    ).tokens;
    await this.ibTokenService.createMany(this.tokens);
    // return this.tokens.map((token: CompoundToken) => ({
    //   underlyingAddress: token.underlyingAddress,
    //   underlyingSymbol: token.underlyingSymbol,
    // }));
  }
}
