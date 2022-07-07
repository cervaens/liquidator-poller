import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(private readonly amqpConnection: AmqpConnection) {}

  getHello(): string {
    return 'Hello World!';
  }

  async sendTestMsg() {
    this.logger.debug('Message sent');
    this.amqpConnection.publish('liquidator-exchange', 'test-msg', {
      msg: 'something',
    });
    this.amqpConnection.publish('liquidator-exchange', 'test-queue-msg', {
      msg: 'something',
    });
    return true;
  }
}
