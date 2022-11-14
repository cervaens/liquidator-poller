import { Injectable, Logger } from '@nestjs/common';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import validatorABI from './ABIs/ValidatorABI.json';
import { AbiItem } from 'web3-utils';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppService } from 'src/app.service';

@Injectable()
export class BlocknativeService {
  constructor(
    private readonly web3Provider: Web3ProviderService,
    private readonly amqpConnection: AmqpConnection,
    private readonly httpService: HttpService,
    private readonly appService: AppService,
  ) {}
  private readonly logger = new Logger(BlocknativeService.name);
  private aggregators: Record<string, any> = {};
  private tokens: Record<string, any> = {};
  private allActiveCandidates: Record<string, Record<string, any>> = {
    Compound: {},
  };
  private currentTokensList = new Set();

  private compoundProxyContracts = {
    cAAVE: '0x0238247E71AD0aB272203Af13bAEa72e99EE7c3c',
    cBAT: '0xeBa6F33730B9751a8BA0b18d9C256093E82f6bC2',
    cCOMP: '0xE270B8E9d7a7d2A7eE35a45E43d17D56b3e272b1',
    cDAI: '0xb2419f587f497CDd64437f1B367E2e80889631ea',
    cETH: '0x264BDDFD9D93D48d759FBDB0670bE1C6fDd50236',
    cFEI: '0xDe2Fa230d4C05ec0337D7b4fc10e16f5663044B0',
    cFRAX: '0xfAD527D1c9F8677015a560cA80b7b56950a61FE1',
    cLINK: '0xBcFd9b1a97cCD0a3942f0408350cdc281cDCa1B1',
    LUSD: '0xBfcbADAa807E25aF90424c8173645B945a401eca',
    cMATIC: '0x44750a79ae69D5E9bC1651E099DFFE1fb8611AbA',
    cMKR: '0xbA895504a8E286691E7dacFb47ae8A3A737e2Ce1',
    cRAI: '0xF0148Ddd8bA74D294E67E65FE1F3f0CD2F43CA8a',
    cREP: '0x90655316479383795416B615B61282C72D8382C1',
    cSUSHI: '0x875acA7030B75b5D8cB59c913910a7405337dFf7',
    cUNI: '0x70f4D236FD678c9DB41a52d28f90E299676d9D90',
    cWBTC: '0x4846efc15CC725456597044e6267ad0b3B51353E',
    cWBTC2: '0x4846efc15CC725456597044e6267ad0b3B51353E',
    cYFI: '0xBa4319741782151D2B1df4799d757892EFda4165',
    cZRX: '0x5c5db112c98dbe5977A4c37AD33F8a4c9ebd5575',
  };

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-list',
  })
  public async deleteFromCandidatesList(msg: Record<string, any>) {
    if (msg.action === 'deleteBelowTimestamp') {
      for (const protocol of Object.keys(this.allActiveCandidates)) {
        for (const id of Object.keys(this.allActiveCandidates[protocol])) {
          if (this.allActiveCandidates[protocol][id].time < msg.timestamp) {
            delete this.allActiveCandidates[protocol][id];
            this.logger.debug(
              `Deleting candidate ${id} from protocol ${protocol} as strong candidate for timestamp lower than ${msg.timestamp}`,
            );
            this.refreshList();
          }
        }
      }
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'strong-candidate',
  })
  public async updateAllCandidatesList(msg: Record<string, any>) {
    if (!this.allActiveCandidates[msg.protocol]) {
      this.allActiveCandidates[msg.protocol] = {};
    }
    if (!this.allActiveCandidates[msg.protocol][msg.address]) {
      this.logger.debug(
        `Setting candidate ${msg.address} from protocol ${msg.protocol} as strong candidate`,
      );
      this.allActiveCandidates[msg.protocol][msg.address] = {
        time: msg.time,
        tokens: msg.tokens,
      };
      this.refreshList();
    } else {
      this.allActiveCandidates[msg.protocol][msg.address].time = msg.time;
    }
  }

  async refreshList() {
    const newSet = new Set();
    for (const candidates of Object.values(
      this.allActiveCandidates['Compound'],
    )) {
      for (const tokenObj of candidates.tokens) {
        if (
          tokenObj.supply_balance_underlying > 0 ||
          tokenObj.borrow_balance_underlying > 0
        ) {
          newSet.add(tokenObj.symbol);
          if (
            !tokenObj.symbol.match(
              process.env.COMPOUND_STATIC_ONE_USD_PRICES,
            ) &&
            !this.currentTokensList.has(tokenObj.symbol)
          ) {
            // Here it might add twice although thats ok
            this.addSymbolToList(tokenObj.symbol);
          }
        }
      }
    }
    this.currentTokensList.forEach((tokenSymbol: string) => {
      if (!newSet.has(tokenSymbol)) {
        this.removeSymbolFromList(tokenSymbol);
      }
    });
  }

  private getAggregatorFromSymbol(symbol: string) {
    for (const aggregator of Object.keys(this.aggregators)) {
      if (this.aggregators[aggregator].tokenSymbol === symbol) {
        return aggregator;
      }
    }
  }

  public async getValidators() {
    for (const tokenSymbol of Object.keys(this.compoundProxyContracts)) {
      try {
        const proxyContract = new this.web3Provider.web3.eth.Contract(
          validatorABI as AbiItem[],
          this.compoundProxyContracts[tokenSymbol],
        );
        const aggregators = await proxyContract.methods
          .getAggregators()
          .call()
          .catch((err) => {
            this.logger.debug(`Couldn't get aggregators: ${err}`);
          });
        this.aggregators[aggregators.current] = {
          tokenSymbol,
          proxyContract: this.compoundProxyContracts[tokenSymbol],
        };
      } catch (err) {
        this.logger.debug('Error instanciating blocknative contracts: ' + err);
      }
    }
    return true;
  }

  processData(tx: Record<string, any>) {
    const method = tx.input.substring(0, 10);

    if (method !== '0xc9807539') {
      return 'Wrong method';
    }

    if (!this.aggregators[tx.to]) {
      this.logger.debug(`Couldn't find aggregator for address tx.to`);
      return false;
    }

    const price = this.getPriceFromJson(tx);

    this.logger.debug(
      `☑️ *Got Prices* from BlockNative for ${
        this.aggregators[tx.to].tokenSymbol
      } | Address: ${
        this.tokens['Compound'][this.aggregators[tx.to].tokenSymbol]
          .underlyingAddress
      } | Price ${price} | Blocknumber ${tx.pendingBlockNumber}`,
    );

    const prices = [
      {
        underlyingAddress:
          this.tokens['Compound'][this.aggregators[tx.to].tokenSymbol]
            .underlyingAddress,
        price,
        blockNumber: tx.pendingBlockNumber,
      },
    ];

    this.amqpConnection.publish('liquidator-exchange', 'prices-updated', {
      protocol: 'Compound',
      prices,
      gasPrices: {
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      },
    });

    return true;
  }

  public getPriceFromJson(tx: Record<string, any>) {
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      0: _report,
      //   1: _rs,
      //   2: _ss,
      //   3: _rawVs,
    } = this.web3Provider.web3.eth.abi.decodeParameters(
      ['bytes', 'bytes32[]', 'bytes32[]', 'bytes32'],
      tx.input.slice(10),
    );

    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      0: rawReportContext,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      1: rawObservers,
      2: observations,
    } = this.web3Provider.web3.eth.abi.decodeParameters(
      ['bytes32', 'bytes32', 'int192[]'],
      _report,
    );

    // 10 ** -2 so that at the end the parsing of 10 ** 6 works as it comes from blocknative as 10 ** 8
    return observations[Math.floor(observations.length / 2)] * 10 ** -2;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'tokens-polled',
  })
  public async updateTokensHandler(msg: Record<string, number>) {
    this.tokens[msg.protocol] = msg.tokens;
  }

  async addSymbolToList(symbol: string) {
    this.currentTokensList.add(symbol);
    const address = this.getAggregatorFromSymbol(symbol);
    this.logger.debug(
      `Blocknative: Adding ${symbol} with address ${address} to list.`,
    );
    if (address && this.appService.amItheMaster()) {
      const res = await this.fetch('address', { address, method: 'post' });
      if (res.error) {
        this.currentTokensList.delete(symbol);
        this.logger.debug(
          `Failed: Blocknative Adding ${symbol} has failed: ${res.error}`,
        );
      }
    }
    return;
  }

  async removeSymbolFromList(symbol: string) {
    this.currentTokensList.delete(symbol);
    const address = this.getAggregatorFromSymbol(symbol);
    this.logger.debug(
      `Blocknative: Removing ${symbol} with address ${address} to list.`,
    );
    const res = await this.fetch('address', { address, method: 'delete' });
    if (res.error) {
      this.currentTokensList.add(symbol);
      this.logger.debug(
        `Failed: Blocknative Removing ${symbol} has failed: ${res.error}`,
      );
    }
    return;
  }

  async fetch(endpoint: string, config: Record<string, any>) {
    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const data = {
      apiKey: process.env.BLOCKNATIVE_API_KEY,
      blockchain: 'ethereum',
      networks: ['main'],
      address: config.address,
    };

    try {
      const json: Record<string, any> = await firstValueFrom(
        this.httpService.request({
          ...params,
          data,
          url: process.env.BLOCKNATIVE_API_URL + `/${endpoint}`,
          method: config.method,
        }),
      );
      return json;
    } catch (error) {
      return { error: error };
    }
  }
}
