import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

function makeId(length: number) {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(private readonly amqpConnection: AmqpConnection) {}
  public nodeId: string;
  private lastCandidatesLoad = 0;
  private lastFetchAccounts = 0;

  private appControl: Record<string, boolean> = {
    isThereAMaster: false,
    iamTheMaster: false,
  };

  setNodeId() {
    this.nodeId = makeId(5);
  }

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
      nodeId: this.nodeId,
    });
  }

  amItheMaster(): boolean {
    return this.appControl.iamTheMaster;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'i-am-master',
  })
  public async thereIsAMaster(msg: Record<string, any>) {
    if (msg.nodeId !== this.nodeId) {
      this.setImNoMaster();
    }
    this.appControl.isThereAMaster = true;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'ask-load-candidates',
  })
  public async askToLoadCandidatesFromDB() {
    if (!this.amItheMaster()) {
      return;
    }

    const time = new Date().getTime();

    if (time - this.lastCandidatesLoad > 4000) {
      this.lastCandidatesLoad = time;
      this.amqpConnection.publish(
        'liquidator-exchange',
        'load-candidates-db',
        {},
      );
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'ask-fetch-accounts',
  })
  public async askToFetchAccounts(msg: Record<string, any>) {
    if (!this.amItheMaster()) {
      return;
    }

    const time = new Date().getTime();

    if (time - this.lastFetchAccounts > 4000) {
      this.lastFetchAccounts = time;
      this.amqpConnection.publish('liquidator-exchange', 'fetch-accounts', {
        init: msg.init || false,
      });
    }
  }
}
