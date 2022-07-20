import { Injectable, Logger } from '@nestjs/common';
// import { Cron } from '@nestjs/schedule';
// import { CompoundPollerController } from '../compound-poller/compound-poller.controller';

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  // @Inject(CompoundPollerController)
  // private readonly compoundController: CompoundPollerController;

  // @Cron('* */2 * * * *')
  // async handleCron() {
  //   this.logger.debug('Called when the current second is 45');
  //   const result = await this.compoundController.pollCTokens();
  //   this.logger.debug(result);
  // }
}
