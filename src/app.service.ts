import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(private readonly amqpConnection: AmqpConnection) {}

  private appControl: Record<string, boolean> = {
    isThereAMaster: false,
    iamTheMaster: false,
  };

  getControlIdStatus(controlId: string): boolean {
    return this.appControl[controlId] ? this.appControl[controlId] : false;
  }

  setControlIdStatus(controlId: string, value: boolean) {
    this.appControl[controlId] = value;
  }

  getIsThereAMaster(): boolean {
    return this.appControl.isThereAMaster;
  }

  setThereIsNoMaster(): boolean {
    this.appControl.isThereAMaster = false;
    return this.appControl.isThereAMaster;
  }

  setImNoMaster(): boolean {
    this.appControl.iamTheMaster = false;
    return this.appControl.iamTheMaster;
  }

  sendJoining() {
    this.amqpConnection.publish('liquidator-exchange', 'worker-joining', {
      timestamp: new Date().getTime(),
    });
  }

  sendImTheMaster(isNew: boolean) {
    this.appControl.iamTheMaster = true;
    this.amqpConnection.publish('liquidator-exchange', 'i-am-master', {
      isNew,
    });
  }

  amItheMaster(): boolean {
    return this.appControl.iamTheMaster;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'i-am-master',
  })
  public async thereIsAMaster() {
    this.appControl.isThereAMaster = true;
  }
}
