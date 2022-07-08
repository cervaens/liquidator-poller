import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { CtokenController } from './mongodb/ctoken/ctoken.controller';
import { CompoundPollerController } from './compound-poller/compound-poller.controller';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Inject(CtokenController)
  private readonly ctokenController: CtokenController;

  @Inject(CompoundPollerController)
  private readonly compoundController: CompoundPollerController;

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('send-test-msg')
  async sendTestMsg() {
    await this.compoundController.pollCTokens();
    // await this.ctokenController.createCtoken({
    //   address: 'test',
    //   symbol: 'ss223',
    //   price: undefined,
    // });
    return this.appService.sendTestMsg();
  }
}
