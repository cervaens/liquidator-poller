import { Controller } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Controller('compound-poller')
export class CompoundPollerController {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async sendTestMsg() {
    console.log('GOT IT');
    this.amqpConnection.publish('liquidator-exchange', 'test-msg', {
      msg: 'test',
    });
    return true;
  }
}
