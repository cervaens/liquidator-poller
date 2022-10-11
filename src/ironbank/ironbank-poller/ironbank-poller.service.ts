import { Catch, Injectable, Logger } from '@nestjs/common';
import { IronBankToken } from '../../mongodb/ib-token/classes/IronBankToken';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { IbAccountsService } from 'src/mongodb/ib-accounts/ib-accounts.service';
// import { IbControlService } from 'src/mongodb/ib-control/ib-control.service';
import { IbTokenService } from 'src/mongodb/ib-token/ib-token.service';
import iTokenAbi from './abis/iTokenAbi.json';
import { AbiItem } from 'web3-utils';

@Injectable()
@Catch()
export class IronbankPollerService {
  constructor(
    private readonly httpService: HttpService,
    private readonly amqpConnection: AmqpConnection,
    private readonly web3Provider: Web3ProviderService,
    private readonly ibAccounts: IbAccountsService,
    // private readonly ibControl: IbControlService,
    private readonly ibToken: IbTokenService,
  ) {}
  private readonly logger = new Logger(IronbankPollerService.name);
  private protocol = 'IronBank';

  private tokenContract = {};
  public accountsSubscription;
  public tokenObj: Record<string, IronBankToken> = {};
  private iTokenPrices: Record<string, any>;

  private topicEnter =
    '0x3ab23ab0d51cccc0c3085aec51f99228625aa1a922b3a8ca89a26b0f2027a1a5';
  private topicExit =
    '0xe699a64c18b07ac5b7301aa273f36a2287239eb9501d81950672794afba29a0d';

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'tokens-polled',
  })
  async updateItokensHandler(msg: Record<string, any>) {
    if (msg.protocol === this.protocol) {
      this.tokenObj = msg.tokens;
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-polled',
  })
  async updatePricesHandler(msg: Record<string, any>) {
    if (msg.protocol !== this.protocol) {
      return;
    }
    this.iTokenPrices = { ...this.iTokenPrices, ...msg.prices };
  }

  async fetchIBtokens(withConfig: Record<string, any>) {
    const json = await this.fetch('itoken', withConfig);

    if (json.error || json.errors) {
      this.logger.warn(
        'Fetch iTokens failed: ' +
          json.error +
          ' ' +
          (json.error.response && json.error.response.statusText),
      );
      return {
        error: json.error,
        tokens: [],
      };
    }

    const tokens =
      json.data.map((i: Record<string, any>) => new IronBankToken(i)) || [];

    for (const token of tokens) {
      this.tokenObj[token.address] = token;
    }
    this.logger.debug('Publishing polled iTokens');
    this.amqpConnection.publish('liquidator-exchange', 'tokens-polled', {
      tokens: this.tokenObj,
      protocol: this.protocol,
    });

    return {
      error: json.error,
      tokens,
    };
  }

  async getAccountsFromUnitroller() {
    const lastAccount = await this.ibAccounts.getLastAccountByBlockNumber();
    const options = {
      fromBlock: (lastAccount && lastAccount.lastBlockNumber) || 1, // If this is uncommented, it will retrieve ALL the logs, enable at your own risk, infura might to throttle the calls temporarily (and actually has a limit of 10000 results)
      address: [process.env.IB_UNITROLLER_ADDRESS],
      topics: [[this.topicEnter, this.topicExit]],
    };

    this.logger.debug(
      `Subscribing to IB Unitroller contract events since block ${options.fromBlock}...`,
    );

    const logInput = [
      {
        type: 'address',
        name: 'market',
      },
      {
        type: 'address',
        name: 'account',
      },
    ];

    this.accountsSubscription = this.web3Provider
      .getWsProvider('Alchemy')
      .eth.subscribe('logs', options, async (err, tx) => {
        if (err || tx == null) {
          this.logger.error(
            'Error when watching incoming transactions: ' + err,
          );
          return;
        }

        tx.topics.forEach((topic) => {
          // If the Transaction Topic is Deposit / Withdraw / Borrow / Repay
          if (topic === this.topicEnter || topic === this.topicExit) {
            // // decode the transaction data byte code so it's readable
            const result = this.web3Provider.web3.eth.abi.decodeLog(
              logInput,
              tx.data,
              tx.topics,
            );

            // this.ibControl.updatingMarkets = true;
            topic === this.topicEnter
              ? this.ibAccounts.accountEntersMarket(
                  result.account,
                  result.market,
                  tx.blockNumber,
                )
              : this.ibAccounts.accountExitsMarket(
                  result.account,
                  result.market,
                  tx.blockNumber,
                );
          }
        });
      });

    this.accountsSubscription.on('error', (error) => {
      this.logger.error(
        'Got an error when watching incoming transactions: ' + error,
      );
    });
  }

  unsubscribeWs() {
    this.accountsSubscription.unsubscribe((error, success) => {
      if (success) {
        this.logger.debug('IB: Successfully unsubscribed from logs.');
      }
    });
  }

  async getAccountBalanceFromToken(account: string, iToken: string) {
    // There are suspended markets not outputted by the API
    if (
      Object.keys(this.tokenContract).length > 0 &&
      !this.tokenContract[iToken]
    ) {
      // this.logger.error('No contract for iToken: ' + iToken);
      return Promise.resolve([0, 0, 0]);
    }
    return this.tokenContract[iToken].methods
      .getAccountSnapshot(account)
      .call();
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'fetch-ib-accounts',
    queue: 'fetch-ib-accounts',
  })
  async fetchAccounts() {
    if (
      !this.tokenObj ||
      !this.iTokenPrices ||
      Object.keys(this.tokenObj).length === 0 ||
      Object.keys(this.iTokenPrices).length === 0
    ) {
      return;
    }
    const accounts = await this.ibAccounts.findAllSortedAndCandidates();
    this.logger.debug(`IB: Polling ${accounts.length} accounts balances`);
    // this.logger.debug(
    //   `IB: Polling ${accounts.length} accounts balances: ${JSON.stringify(
    //     accounts.map((account) => account.address),
    //   )}`,
    // );
    const promises: Record<string, Record<string, Promise<any>>> = {};

    for (const account of accounts) {
      if (!promises[account._id]) {
        promises[account._id] = {};
      }
      for (const token of account.tokens) {
        try {
          promises[account._id][token.address] =
            this.getAccountBalanceFromToken(account._id, token.address);
        } catch (error) {
          this.logger.error(error.message);
        }
      }
    }
    const updatedAccounts = [];
    const promiseExecution = async () => {
      for (const accountId of Object.keys(promises)) {
        const tokens = [];
        for (const tokenId of Object.keys(promises[accountId])) {
          try {
            const res = await promises[accountId][tokenId];
            tokens.push({
              address: tokenId,
              borrow_balance_underlying: parseFloat(res[2]),
              supply_balance_itoken: parseFloat(res[1]),
            });
          } catch (error) {
            this.logger.error(error.message);
          }
        }
        updatedAccounts.push({ address: accountId, _id: accountId, tokens });
      }
    };

    await promiseExecution();
    // this.logger.debug('Updating accounts' + JSON.stringify(updatedAccounts));
    this.logger.debug('IB: Finished polling accounts balances');
    // While I dont develop prices poll I pass the tokens obj

    this.amqpConnection.publish('liquidator-exchange', 'ib-accounts-polled', {
      accounts: updatedAccounts,
    });

    await this.ibAccounts.calculateHealthAndStore(
      updatedAccounts,
      this.tokenObj,
      this.iTokenPrices,
    );
  }

  async initTokenContracts() {
    const tokens = await this.ibToken.findAll();

    for (const token of tokens) {
      try {
        this.tokenContract[token.address] = new (this.web3Provider.getProvider(
          'AWS',
        ).eth.Contract)(iTokenAbi as AbiItem[], token.address);
      } catch (err) {
        this.logger.debug(
          'Error instanciating iToken contract: ' + token.address + ' ' + err,
        );
      }
    }
    return true;
  }

  async fetch(endpoint: string, withConfig: Record<string, any>) {
    const params = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    const urlParams = Object.keys(withConfig)
      .map((key) => key + '=' + withConfig[key])
      .join('&');

    try {
      const json: Record<string, any> = await firstValueFrom(
        this.httpService.get(
          process.env.IRONBANK_ENDPOINT + `${endpoint}?` + urlParams,
          params,
        ),
      );

      return json;
    } catch (error) {
      return { error: error };
    }
  }
}
