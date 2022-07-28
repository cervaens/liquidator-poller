import { Injectable, Logger, Inject } from '@nestjs/common';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
// import { Web3ProviderService } from './web3-provider/web3-provider.service';
import Web3 from 'web3';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(
    private readonly amqpConnection: AmqpConnection,
    // private readonly web3ServiceClass: Web3ProviderService,
    // @Inject('WEB3') private conn: Web3,
    @Inject('WEB3PROV') private conWeb3: Web3,
    @Inject('WEB3WS') private web3Ws: Web3,
  ) {}

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

  sendImTheMaster() {
    this.iamTheMaster = true;
    this.amqpConnection.publish('liquidator-exchange', 'i-am-master', {});
    this.logger.debug('Sending Im the master');
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
    this.logger.debug('There is a master');
  }
}
