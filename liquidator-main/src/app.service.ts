import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(private readonly amqpConnection: AmqpConnection) {}

  private isThereAMaster = false;
  private iamTheMaster = false;
  getHello(): string {
    return 'Hello World!';
  }

  getIsThereAMaster(): boolean {
    return this.isThereAMaster;
  }

  setThereIsNoMaster(): boolean {
    this.isThereAMaster = false;
    return this.isThereAMaster;
  }

  setImNoMaster(): boolean {
    this.iamTheMaster = false;
    return this.iamTheMaster;
  }

  sendJoining() {
    this.amqpConnection.publish('liquidator-exchange', 'worker-joining', {
      timestamp: new Date().getTime(),
    });
  }

  sendImTheMaster() {
    this.iamTheMaster = true;
    this.amqpConnection.publish('liquidator-exchange', 'i-am-master', {});
  }

  amItheMaster(): boolean {
    return this.iamTheMaster;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'i-am-master',
  })
  public async thereIsAMaster() {
    this.isThereAMaster = true;
  }
}
