import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  @Cron('*/45 * * * * *')
  handleCron() {
    this.logger.debug('Called when the current second is 45');
  }
}
