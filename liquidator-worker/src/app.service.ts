import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'test-msg',
  })
  public async messageTestHandler(msg: Record<string, unknown>) {
    console.log(`Received event: ${JSON.stringify(msg)}`);
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'test-queue-msg',
    queue: 'tasks',
  })
  public async messageQueueHandler(msg: Record<string, unknown>) {
    console.log(`Received task: ${JSON.stringify(msg)}`);
  }
}
