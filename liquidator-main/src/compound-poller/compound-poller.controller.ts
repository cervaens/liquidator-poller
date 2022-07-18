import { Controller, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CompoundPollerService } from './compound-poller.service';
import { CtokenController } from '../mongodb/ctoken/ctoken.controller';

@Controller('compound-poller')
export class CompoundPollerController {
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly compoundPollerService: CompoundPollerService,
    private readonly ctokenController: CtokenController,
  ) {}

  private readonly logger = new Logger(CompoundPollerController.name);
  async pollCTokens() {
    const { tokens }: Record<string, any> =
      await this.compoundPollerService.fetch({});
    this.logger.debug('Starting polling CTokens', tokens);
    await this.ctokenController.createMany(tokens);

    return 'Done';
  }

  async sendTestMsg() {
    console.log('GOT IT');
    this.amqpConnection.publish('liquidator-exchange', 'test-msg', {
      msg: 'test',
    });
    return true;
  }
}
