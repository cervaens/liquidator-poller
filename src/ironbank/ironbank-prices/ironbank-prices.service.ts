import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
// import { IbTokenService } from 'src/mongodb/ib-token/ib-token.service';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import chainlinkProxyContractAbi from './abis/ironbankChainlinkABI.json';
import { AbiItem } from 'web3-utils';

@Injectable()
export class IronbankPricesService {
  private readonly logger = new Logger(IronbankPricesService.name);
  private chainlinkProxyContract = [];
  private chainlinkCurrentIndex = 0;
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly provider: Web3ProviderService,
  ) {}

  private iTokens = {} as Record<string, any>;
  private iTokenPrices = {} as Record<string, number>;
  private protocol = 'IronBank';

  async onModuleInit(): Promise<void> {
    for (const prov of this.provider.web3Providers) {
      this.chainlinkProxyContract.push(
        await this.initChainlinkProxyContract(prov),
      );
    }
  }

  getChainLinkContractNextProvider() {
    this.chainlinkCurrentIndex += 1;
    if (this.chainlinkCurrentIndex >= this.chainlinkProxyContract.length) {
      this.chainlinkCurrentIndex = 0;
    }
    return this.chainlinkProxyContract[this.chainlinkCurrentIndex];
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'tokens-polled',
  })
  async updateItokensHandler(msg: Record<string, any>) {
    if (msg.protocol === this.protocol) {
      this.iTokens = msg.tokens;
    }
  }

  getITokensFiltered(regexStr: string, negate = false) {
    return Object.values(this.iTokens).filter((doc) =>
      negate ? !doc.symbol.match(regexStr) : doc.symbol.match(regexStr),
    );
  }

  async getTokenPrice(tokenSymbol: string) {
    return this.getChainLinkContractNextProvider()
      .methods.getUnderlyingPrice(tokenSymbol)
      .call()
      .catch((err) => {
        this.logger.error(`Couldn't get price for ${tokenSymbol}: ${err}`);
      });
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'poll-ib-prices',
  })
  async getTokensUnderlyingPrice(
    msg: Record<string, Array<Record<string, any>>>,
  ) {
    this.logger.debug('Getting iToken prices');
    const tokenPricesUpdated = {};
    const promises: Record<string, Promise<any>> = {};
    const contract = this.getChainLinkContractNextProvider();
    const index = this.chainlinkCurrentIndex;

    for (const token of msg.tokens) {
      promises[token.address] = contract.methods
        .getUnderlyingPrice(token.address)
        .call()
        .catch((err) => {
          this.logger.error(`Couldn't get price for ${token.address}: ${err}`);
        })
        .then((res) => {
          const valueUSD =
            res * 10 ** (0 - 18 - 18 + token.decimals_underlying);
          return valueUSD;
        });
    }

    const promiseExecution = async () => {
      for (const token of Object.keys(promises)) {
        try {
          const res = await promises[token];
          if (this.iTokenPrices[token] !== res && res) {
            this.iTokenPrices[token] = res;
            tokenPricesUpdated[token] = { blockNumber: 0, price: res };
          }
        } catch (error) {
          this.logger.error(error.message);
        }
      }
    };

    await promiseExecution();
    if (Object.keys(tokenPricesUpdated).length > 0) {
      this.logger.debug(
        '☑️ *Got Prices* from ' +
          this.provider.providersList[index] +
          ' for IronBank: ' +
          JSON.stringify(tokenPricesUpdated),
      );
      this.amqpConnection.publish('liquidator-exchange', 'prices-polled', {
        protocol: 'IronBank',
        prices: tokenPricesUpdated,
      });
    }
  }

  async initChainlinkProxyContract(provider) {
    // init new web3 with our infura key

    try {
      return new provider.eth.Contract(
        chainlinkProxyContractAbi as AbiItem[],
        process.env.IB_CHAINLINK_PROXY ||
          '0xD5734c42E2e593933231bE61BAc2B94ACdc44DC4',
      );
    } catch (err) {
      this.logger.debug('Error instanciating Chainlink proxy contract');
    }
  }
}
