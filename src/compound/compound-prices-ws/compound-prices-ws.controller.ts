import { Controller, Inject } from '@nestjs/common';
import { AppService } from 'src/app.service';
import { CompoundPricesWsService } from './compound-prices-ws.service';

@Controller('compound-prices-ws')
export class CompoundPricesWsController {
  constructor(
    @Inject('CompoundPricesPrimaryInject')
    private readonly compoundPricesServicePrimary: CompoundPricesWsService,
    @Inject('CompoundPricesSecondaryInject')
    private readonly compoundPricesServiceSecondary: CompoundPricesWsService,

    @Inject(AppService) private appService: AppService,
  ) {}
  async onApplicationBootstrap(): Promise<void> {
    let amITheMaster = false;
    setInterval(async () => {
      if (this.appService.amItheMaster() && !amITheMaster) {
        amITheMaster = true;
        this.compoundPricesServicePrimary.subscribeToBlocks();
        this.compoundPricesServicePrimary.subscribeToPriceEvents();
        this.compoundPricesServiceSecondary.subscribeToBlocks();
        this.compoundPricesServiceSecondary.subscribeToPriceEvents();
      } else if (!this.appService.amItheMaster() && amITheMaster) {
        amITheMaster = false;
        // unsubscribe if for some reason stops being master
        this.compoundPricesServicePrimary.unSubscribeWSs();
        this.compoundPricesServiceSecondary.unSubscribeWSs();
      }
    }, 5500);
  }
}
