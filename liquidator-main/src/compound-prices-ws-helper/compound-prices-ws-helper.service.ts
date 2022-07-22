import { Injectable, Logger, Inject } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
// import { Web3ProviderService } from './web3-provider/web3-provider.service';
import Web3 from 'web3';
import { CtokenController } from 'src/mongodb/ctoken/ctoken.controller';
import uniswapAnchorAbi from './abis/uniswapAnchoredView_ABI.json';
import { AbiItem } from 'web3-utils';

@Injectable()
export class CompoundPricesWsHelperService {
  private readonly logger = new Logger(CompoundPricesWsHelperService.name);
  private uniswapAnchorContract;
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly ctoken: CtokenController,
    @Inject('WEB3PROV') private conWeb3: Web3,
  ) {}

  async onModuleInit(): Promise<void> {
    this.uniswapAnchorContract = await this.initUniswapAnchoredViewContract();
  }

  anchorPriceUpdatedInput = [
    {
      type: 'uint256',
      name: 'price',
    },
    {
      type: 'uint256',
      name: 'oldTimestamp',
    },
    {
      type: 'uint256',
      name: 'newTimestamp',
    },
  ];

  priceUpdatedInput = [
    {
      type: 'uint256',
      name: 'price',
    },
  ];

  logToObject = (tx: Record<string, any>) => {
    let result;
    if (
      tx.topics[0] === process.env.COMPOUND_UNISWAPANCHORVIEW_PRICEUPDATED_TOPIC
    ) {
      result = this.conWeb3.eth.abi.decodeLog(
        this.priceUpdatedInput,
        tx.data,
        tx.topics,
      );
    } else if (
      tx.topics[0] ===
      process.env.COMPOUND_UNISWAPANCHORVIEW_ANCHORPRICEUPDATED_TOPIC
    ) {
      result = this.conWeb3.eth.abi.decodeLog(
        this.anchorPriceUpdatedInput,
        tx.data,
        tx.topics,
      );
    }
    return result;
  };

  async getTokenInfo(tokenHash: string) {
    return await this.uniswapAnchorContract.methods
      .getTokenConfigBySymbolHash(tokenHash)
      .call();
  }

  async getTokenPrice(tokenSymbol: string) {
    return await this.uniswapAnchorContract.methods.price(tokenSymbol).call();
  }

  async getTokensPrice(tokens: Array<string>) {
    const tokenPrices = {};
    const promises: Record<string, Promise<any>> = {};

    for (const token of tokens) {
      // Compound considers stable coins as 1 dollar
      if (token.match('USDC|USDT|TUSD|USDP')) {
        tokenPrices[token] = '1000000';
      } else if (token === 'WBTC') {
        promises[token] = this.uniswapAnchorContract.methods
          .price('BTC')
          .call();
      } else {
        promises[token] = this.uniswapAnchorContract.methods
          .price(token)
          .call();
      }
    }

    const promiseExecution = async () => {
      for (const token of Object.keys(promises)) {
        try {
          const res = await promises[token];
          tokenPrices[token] = res;
        } catch (error) {
          this.logger.error(error.message);
        }
      }
    };

    this.amqpConnection.publish('liquidator-exchange', 'prices-polled', {});

    await promiseExecution();
    return tokenPrices;
  }

  async initUniswapAnchoredViewContract() {
    // init new web3 with our infura key

    try {
      return new this.conWeb3.eth.Contract(
        uniswapAnchorAbi as AbiItem[],
        process.env.COMPOUND_UNISWAPANCHORVIEW_ADDRESS ||
          '0x65c816077C29b557BEE980ae3cC2dCE80204A0C5',
      );
    } catch (err) {
      this.logger.debug('Error instanciating unisapAnchor contract');
    }
  }
}
