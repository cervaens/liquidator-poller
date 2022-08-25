import { Controller, Inject } from '@nestjs/common';
import { AppService } from 'src/app.service';
import { CompoundPricesWsService } from './compound-prices-ws.service';

@Controller('compound-prices-ws')
export class CompoundPricesWsController {
  constructor(
    private readonly compoundPricesService: CompoundPricesWsService,
    @Inject(AppService) private appService: AppService,
  ) {}
  async onApplicationBootstrap(): Promise<void> {
    let amITheMaster = false;
    setInterval(async () => {
      if (this.appService.amItheMaster() && !amITheMaster) {
        this.compoundPricesService.subscribeToBlocks();
        this.compoundPricesService.subscribeToPriceEvents();
        amITheMaster = true;
      } else if (!this.appService.amItheMaster() && amITheMaster) {
        // unsubscribe if for some reason stops being master
        this.compoundPricesService.unSubscribeWSs();
        amITheMaster = false;
      }
    }, 5500);
  }
}
