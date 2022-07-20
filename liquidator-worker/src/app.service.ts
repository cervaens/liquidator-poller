import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-updated',
  })
  public async pricesUpdatedHandler(msg: Record<string, unknown>) {
    console.log(`Received price update: ${msg.length} ${JSON.stringify(msg)}`);
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'accounts-polled',
    queue: 'accounts',
  })
  public async accountsPolledHandler(
    msg: Record<string, Array<Record<string, any>>>,
  ) {
    const accounts = msg.accounts;
    console.log(`Received polled accounts: ${accounts.length}`);
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
