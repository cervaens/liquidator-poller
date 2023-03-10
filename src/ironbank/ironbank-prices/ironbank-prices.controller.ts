// import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Controller, Inject } from '@nestjs/common';
import { AppService } from 'src/app.service';
// import { IronbankPollerController } from '../ironbank-poller/ironbank-poller.controller';
import { IronbankPricesService } from './ironbank-prices.service';

@Controller('ironbank-prices')
export class IronbankPricesController {
  constructor(
    private readonly ironBankPrices: IronbankPricesService,
    private readonly amqpConnection: AmqpConnection,
    @Inject(AppService) private appService: AppService, // private readonly amqpConnection: AmqpConnection,
  ) {}

  private stableCoinsStr = '/EUR|USD|DAI|CHF|GBP|MIM/';
  private largeUpdatePeriodStr = '/SNX|CRV|JPY|KRW|CVX/';
  private stableAndLargeStr = this.stableCoinsStr + this.largeUpdatePeriodStr;
  private moduleEnabled =
    process.env.IRONBANK_MODULE_ENABLED === 'false' ? false : true;

  async onApplicationBootstrap(): Promise<void> {
    if (this.moduleEnabled) {
      this.stableAndLargeStr.replace('//', '|');
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
          this.pollLongPeriodCoins();
        }
      }, parseInt(process.env.IB_POLLING_PRICES_MEDIUM));

      setInterval(() => {
        if (
          this.appService.amItheMaster() &&
          this.appService.getControlIdStatus('IB-poller-init-finished')
        ) {
          this.pollAllCoins();
        }
      }, parseInt(process.env.IB_POLLING_PRICES_SHORT));
    }
  }

  async pollStableCoins() {
    const tokens = this.ironBankPrices.getITokensFiltered(this.stableCoinsStr);
    this.amqpConnection.publish('liquidator-exchange', 'poll-ib-prices', {
      tokens,
    });
  }

  async pollLongPeriodCoins() {
    const tokens = this.ironBankPrices.getITokensFiltered(
      this.largeUpdatePeriodStr,
    );
    this.amqpConnection.publish('liquidator-exchange', 'poll-ib-prices', {
      tokens,
    });
  }

  async pollAllCoins() {
    const tokens = this.ironBankPrices.getITokensFiltered(
      this.stableAndLargeStr,
      true,
    );
    this.amqpConnection.publish('liquidator-exchange', 'poll-ib-prices', {
      tokens,
    });
  }
}
