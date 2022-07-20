import { Injectable, Logger, Inject } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
// import { Web3ProviderService } from './web3-provider/web3-provider.service';
import Web3 from 'web3';
import { CompoundPricesWsHelperService } from '../compound-prices-ws-helper/compound-prices-ws-helper.service';
import { CtokenController } from 'src/mongodb/ctoken/ctoken.controller';

@Injectable()
export class CompoundPricesWsService {
  private readonly logger = new Logger(CompoundPricesWsService.name);
  private addressFromHash: Record<string, string> = {};
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly ctoken: CtokenController,
    // @Inject('WEB3') private conn: Web3,
    @Inject('WEB3PROV') private conWeb3: Web3,
    @Inject('WEB3WS') private web3Ws: Web3,
    private helper: CompoundPricesWsHelperService,
  ) {
    const options = {
      address:
        process.env.COMPOUND_UNISWAPANCHORVIEW_ADDRESS ||
        '0x65c816077C29b557BEE980ae3cC2dCE80204A0C5',
      topics: [
        process.env.COMPOUND_UNISWAPANCHORVIEW_ANCHORPRICEUPDATED_TOPIC ||
          '0xac9b6bb0c67df7ef0d18e58e4bd539c4d6f780c4c8f341cd8e649109edeb5faf',
      ],
    };

    this.web3Ws.eth.subscribe('logs', options, async (err, tx) => {
      if (err) return;

      let extraUpdate = null;
      if (!this.addressFromHash[tx.topics[1]]) {
        const tokenInfo = await this.helper.getTokenInfo(tx.topics[1]);
        this.addressFromHash[tx.topics[1]] =
          tokenInfo && tokenInfo.cToken && tokenInfo.cToken.toLowerCase();
        extraUpdate = {
          tokenHash: tx.topics[1],
        };
      }

      const priceObj = this.helper.logToObject(tx);

      this.amqpConnection.publish('liquidator-exchange', 'test-msg', {
        address: this.addressFromHash[tx.topics[1]],
        price: parseInt(priceObj.anchorPrice),
        timestamp: parseInt(priceObj.newTimestamp),
      });

      await this.ctoken.updateCtokenPrice(
        this.addressFromHash[tx.topics[1]],
        parseInt(priceObj.anchorPrice),
        parseInt(priceObj.newTimestamp),
        extraUpdate,
      );

      this.logger.debug(
        `☑️ *Got Prices* | Address: ${
          this.addressFromHash[tx.topics[1]]
        } Price: ${priceObj.anchorPrice}`,
      );
    });
  }

  //   async onApplicationBootstrap(): Promise<void> {}

  /**
   * Here we load all tokenHash and address mapping
   */
  async onModuleInit(): Promise<void> {
    (
      await this.ctoken.getCtokensWithQuery({}, { tokenHash: 1, address: 1 })
    ).forEach((doc) => {
      if (doc.tokenHash) {
        this.addressFromHash[doc.tokenHash] = doc.address;
      }
    });
  }

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
