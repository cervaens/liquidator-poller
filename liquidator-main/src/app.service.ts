import { Injectable, Logger, Inject } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
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
