import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { CompoundPricesWsHelperService } from './compound-prices-ws-helper/compound-prices-ws-helper.service';
import { CtokenController } from 'src/mongodb/ctoken/ctoken.controller';
import Web3 from 'web3';

function getProviderId(providerUrl) {
  if (providerUrl.match(/amazon/)) {
    return 'AWS';
  } else if (providerUrl.match(/infura/)) {
    return 'Infura';
  } else if (providerUrl.match(/alchemy/)) {
    return 'Alchemy';
  }
}

@Injectable()
export class CompoundPricesWsService {
  private readonly logger = new Logger(CompoundPricesWsService.name);
  private cTokenFromHash: Record<string, Record<string, any>> = {};
  private providerId: string;
  private protocol = 'Compound';
  private noLiquidationCheck =
    process.env.COMPOUND_UNISWAPANCHORVIEW_NO_LIQUIDATION_CHECK === 'true'
      ? true
      : false;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly ctoken: CtokenController,
    private web3Ws: Web3,
    private helper: CompoundPricesWsHelperService,
  ) {
    this.providerId = getProviderId(this.web3Ws.eth.currentProvider['url']);
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
    // this.web3Ws.eth.subscribe('newBlockHeaders', (err, result) => {
    //   this.logger.debug(
    //     `☑️ *Got New block* | Our timestamp: ${parseInt(
    //       (new Date().getTime() / 1000).toString(),
    //     )} block timestamp:  ${result.timestamp} blocknumber: ${result.number}`,
    //   );
    // });
  }

  async unSubscribeWSs() {
    this.logger.debug('Unsubscribing Websocket...');
    this.web3Ws.eth.clearSubscriptions((error, result) => {
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
    this.logger.debug('Subscribing to Uniswap Anchorview events... ');
    this.web3Ws.eth.subscribe('logs', options, async (err, tx) => {
      if (err) {
        this.logger.debug(`*Error* from ${this.providerId} | ERROR: ${err}`);
      }

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
        blockNumber: tx.blockNumber,
      });

      // Here we group all prices from within 200 ms
      // just not to trigger the same logic per price on the same second
      if (msgPrices.length === 1) {
        setTimeout(() => {
          this.amqpConnection.publish('liquidator-exchange', 'prices-updated', {
            protocol: this.protocol,
            prices: msgPrices,
            noLiquidationCheck: this.noLiquidationCheck,
          });
          msgPrices = [];
        }, 200);
      }

      try {
        await this.ctoken.updateCtokenPriceFromAddressOrSymbol(
          this.cTokenFromHash[tx.topics[1]].address,
          null,
          parseInt(priceObj.price),
          extraUpdate,
        );
      } catch (err) {
        this.logger.debug("Couldn't update price in DB." + err);
      }

      this.logger.debug(
        `☑️ *Got Prices* from ${this.providerId} | Address: ${
          this.cTokenFromHash[tx.topics[1]].underlyingAddress
        } Price: ${priceObj.price} blocknumber: ${tx.blockNumber}`,
      );
    });
  }

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
