import { Controller, Get, Logger, Patch } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  async onApplicationBootstrap(): Promise<void> {
    this.appService.setNodeId();
    this.appService.sendJoining();
    setInterval(() => {
      // Check if there's a master already
      const isThereAMaster = this.appService.getIsThereAMaster();
      // In case there is a master, set it to false which will become true
      // after receiving a master claim from another worker
      this.appService.setThereIsNoMaster();

      // But if there's no master become the master
      if (!isThereAMaster) {
        this.appService.sendImTheMaster(true);
        this.logger.debug('Sending Im the new master');
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));

    setInterval(() => {
      if (this.appService.amItheMaster()) {
        this.appService.sendImTheMaster(false);
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
