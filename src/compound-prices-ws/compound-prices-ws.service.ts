import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CompoundPricesWsHelperService } from '../compound-prices-ws-helper/compound-prices-ws-helper.service';
import { CtokenController } from 'src/mongodb/ctoken/ctoken.controller';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';

@Injectable()
export class CompoundPricesWsService {
  private readonly logger = new Logger(CompoundPricesWsService.name);
  private cTokenFromHash: Record<string, Record<string, any>> = {};

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly ctoken: CtokenController,
    private readonly provider: Web3ProviderService,
    private helper: CompoundPricesWsHelperService,
  ) {
    // provider.web3Ws.eth
    //   .subscribe('pendingTransactions', function (error, result) {
    //     if (!error) console.log(result);
    //   })
    //   .on('data', async (transaction) => {
    //     setTimeout(async () => {
    //       try {
    //         const tx = await conWeb3.eth.getTransaction(transaction);
    //         console.log(tx);
    //       } catch (err) {
    //         console.error(err);
    //       }
    //     });
    //   });
  }

  async subscribeToBlocks() {
    // this.provider.web3Ws.eth.subscribe('newBlockHeaders', (err, result) => {
    //   this.logger.debug(
    //     `☑️ *Got New block* | Our timestamp: ${parseInt(
    //       (new Date().getTime() / 1000).toString(),
    //     )} block timestamp:  ${result.timestamp} blocknumber: ${result.number}`,
    //   );
    // });
  }

  async unSubscribeWSs() {
    this.provider.web3Ws.eth.clearSubscriptions((error, result) => {
      this.logger.debug('Unsubscribed: ' + result);
    });
  }

  async subscribeToPriceEvents() {
    const options = {
      address:
        process.env.COMPOUND_UNISWAPANCHORVIEW_ADDRESS ||
        '0x65c816077C29b557BEE980ae3cC2dCE80204A0C5',
      topics: [
        [
          process.env.COMPOUND_UNISWAPANCHORVIEW_PRICEUPDATED_TOPIC ||
            '0x46eec4e0eeeef5830de3472bb39db7e52b1c809286dc87c4b85b20e003cc70c3',
          //   process.env.COMPOUND_UNISWAPANCHORVIEW_ANCHORPRICEUPDATED_TOPIC ||
          //     '0xac9b6bb0c67df7ef0d18e58e4bd539c4d6f780c4c8f341cd8e649109edeb5faf',
        ],
      ],
    };
    let msgPrices = [];
    this.provider.web3Ws.eth.subscribe('logs', options, async (err, tx) => {
      if (err) return;

      let extraUpdate = null;

      if (!this.cTokenFromHash[tx.topics[1]]) {
        const tokenInfo = await this.helper.getTokenInfo(tx.topics[1]);
        this.cTokenFromHash[tx.topics[1]] = {
          address: tokenInfo.cToken && tokenInfo.cToken.toLowerCase(),
          underlyingAddress:
            tokenInfo.underlying && tokenInfo.underlying.toLowerCase(),
          underlyingSymbol: tokenInfo.underlyingSymbol,
        };
        extraUpdate = {
          tokenHash: tx.topics[1],
        };
      }

      const priceObj = this.helper.logToObject(tx);
      msgPrices.push({
        underlyingAddress: this.cTokenFromHash[tx.topics[1]].underlyingAddress,
        price: parseInt(priceObj.price),
      });

      // Here we group all prices from within 200 ms
      // just not to trigger the same logic per price on the same second
      if (msgPrices.length === 1) {
        setTimeout(() => {
          this.amqpConnection.publish(
            'liquidator-exchange',
            'prices-updated',
            msgPrices,
          );
          msgPrices = [];
        }, 200);
      }

      await this.ctoken.updateCtokenPriceFromAddressOrSymbol(
        this.cTokenFromHash[tx.topics[1]].address,
        null,
        parseInt(priceObj.price),
        extraUpdate,
      );

      this.logger.debug(
        `☑️ *Got Prices* | Address: ${
          this.cTokenFromHash[tx.topics[1]].underlyingAddress
        } Price: ${priceObj.price}`,
      );
    });
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'poll-prices',
  })
  public async pollAndStorePrices(tokens: Array<Record<string, any>>) {
    const tokenPrices = await this.helper.getTokensPrice(tokens);
    await this.ctoken.updateCtokensPrices(tokenPrices);
  }

  //   async onApplicationBootstrap(): Promise<void> {}

  /**
   * Here we load all tokenHash and address mapping
   */
  async onModuleInit(): Promise<void> {
    (
      await this.ctoken.getCtokensWithQuery(
        {},
        { tokenHash: 1, address: 1, underlyingSymbol: 1, underlyingAddress: 1 },
      )
    ).forEach((doc) => {
      if (doc.tokenHash) {
        this.cTokenFromHash[doc.tokenHash] = {
          address: doc.address,
          underlyingAddress: doc.underlyingAddress,
          underlyingSymbol:
            doc.underlyingSymbol ||
            '0x0000000000000000000000000000000000000000',
        };
      }
    });
  }

  getHello(): string {
    return 'Hello World!';
  }
}
