// import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Controller, Inject } from '@nestjs/common';
import { AppService } from 'src/app.service';
// import { IronbankPollerController } from '../ironbank-poller/ironbank-poller.controller';
import { IronbankPricesService } from './ironbank-prices.service';

@Controller('ironbank-prices')
export class IronbankPricesController {
  constructor(
    private readonly ironBankPrices: IronbankPricesService,
    @Inject(AppService) private appService: AppService, // private readonly amqpConnection: AmqpConnection,
  ) {}

  private stableCoinsStr = '/EUR|USD|DAI|CHF|GBP/';
  // private iTokenPrices: Record<string, any>;

  async onApplicationBootstrap(): Promise<void> {
    setInterval(() => {
      if (
        this.appService.amItheMaster() &&
        this.appService.getControlIdStatus('IB-poller-init-finished')
      ) {
        this.pollStableCoins();
      }
    }, parseInt(process.env.IB_POLLING_PRICES_LONG));

    setInterval(() => {
      if (
        this.appService.amItheMaster() &&
        this.appService.getControlIdStatus('IB-poller-init-finished')
      ) {
        this.pollNonStableCoins();
      }
    }, parseInt(process.env.IB_POLLING_PRICES_SHORT));
  }

  async pollStableCoins() {
    console.log('CALLING POLL STABLE');
    const tokens = this.ironBankPrices.getITokensFiltered(this.stableCoinsStr);
    this.ironBankPrices.getTokensUnderlyingPrice(tokens);
  }

  async pollNonStableCoins() {
    console.log('CALLING POLL NON STABLE');
    const tokens = this.ironBankPrices.getITokensFiltered(
      this.stableCoinsStr,
      true,
    );
    this.ironBankPrices.getTokensUnderlyingPrice(tokens);
  }
}
