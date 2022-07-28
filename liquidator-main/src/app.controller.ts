import { Controller, Get, Inject, Patch } from '@nestjs/common';
import { AppService } from './app.service';
import { CtokenController } from './mongodb/ctoken/ctoken.controller';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {
    console.log('HERE');
  }

  @Inject(CtokenController)
  private readonly ctokenController: CtokenController;

  async onApplicationBootstrap(): Promise<void> {
    setInterval(() => {
      const isThereAMaster = this.appService.getIsThereAMaster();
      this.appService.setThereIsNoMaster();
      if (!isThereAMaster) {
        this.appService.sendImTheMaster();
      }
    }, 5000);

    setInterval(() => {
      if (this.appService.amItheMaster()) {
        this.appService.sendImTheMaster();
      }
    }, 2500);
  }

  @Get()
  amITheMaster(): boolean {
    return this.appService.amItheMaster();
  }

  @Patch('no-master')
  setNoMaster(): boolean {
    return this.appService.setImNoMaster();
  }
}
