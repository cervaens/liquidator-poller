import { Controller, Get, Inject, Logger, Patch } from '@nestjs/common';
import { AppService } from './app.service';
import { CtokenController } from './mongodb/ctoken/ctoken.controller';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  @Inject(CtokenController)
  private readonly ctokenController: CtokenController;

  async onApplicationBootstrap(): Promise<void> {
    this.appService.sendJoining();
    setInterval(() => {
      // Check if there's a master already
      const isThereAMaster = this.appService.getIsThereAMaster();
      // In case there is a master, set it to false which will become true
      // after receiving a master claim from another worker
      this.appService.setThereIsNoMaster();

      // But if there's no master become the master
      if (!isThereAMaster) {
        this.appService.sendImTheMaster();
        this.logger.debug('Sending Im the master');
      }
    }, 5500);

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
