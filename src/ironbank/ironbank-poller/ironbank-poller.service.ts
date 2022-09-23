import { Injectable, Logger } from '@nestjs/common';
import { IronBankToken } from '../../mongodb/ib-token/classes/IronBankToken';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { IbAccountsService } from 'src/mongodb/ib-accounts/ib-accounts.service';
import { IbControlService } from 'src/mongodb/ib-control/ib-control.service';
import { IbTokenService } from 'src/mongodb/ib-token/ib-token.service';
import Web3 from 'web3';
import iTokenAbi from './abis/iTokenAbi.json';
import { AbiItem } from 'web3-utils';

@Injectable()
export class IronbankPollerService {
  constructor(
    private readonly httpService: HttpService,
    private readonly amqpConnection: AmqpConnection,
    private readonly web3Provider: Web3ProviderService,
    private readonly ibAccounts: IbAccountsService,
    private readonly ibControl: IbControlService,
    private readonly ibToken: IbTokenService,
  ) {}
  private readonly logger = new Logger(IronbankPollerService.name);

  private tokenContract = {};
  public firstAccountsPollFinished = false;
  public accountsSubsciption;
  private tokenObj;

  private topicEnter =
    '0x3ab23ab0d51cccc0c3085aec51f99228625aa1a922b3a8ca89a26b0f2027a1a5';
  private topicExit =
    '0xe699a64c18b07ac5b7301aa273f36a2287239eb9501d81950672794afba29a0d';

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

    this.tokenObj = {};
    for (const token of tokens) {
      this.tokenObj[token.address] = token;
    }
    this.amqpConnection.publish('liquidator-exchange', 'itokens-polled', {
      ...this.tokenObj,
    });

    return {
      error: json.error,
      tokens,
    };
  }

  async getAccountsFromUnitroller() {
    const controlObj = await this.ibControl.getControlObj();
    const options = {
      fromBlock: controlObj.lastBlockNumberUnitrollerPoller || 15457563, // If this is uncommented, it will retrieve ALL the logs, enable at your own risk, infura might to throttle the calls temporarily (and actually has a limit of 10000 results)
      address: [process.env.IB_UNITROLLER_ADDRESS],
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

    let timeOut: any;
    this.accountsSubsciption = this.web3Provider
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
            if (timeOut) {
              clearTimeout(timeOut);
            }
            // // decode the transaction data byte code so it's readable
            const result = this.web3Provider.web3.eth.abi.decodeLog(
              logInput,
              tx.data,
              tx.topics,
            );

            topic === this.topicEnter
              ? this.ibAccounts.accountEntersMarket(
                  result.account,
                  result.market,
                )
              : this.ibAccounts.accountExitsMarket(
                  result.account,
                  result.market,
                );

            // We just want to update blockNumber when its the last of a bunch
            timeOut = setTimeout(() => {
              this.logger.debug(
                'Updating lastBlockNumber for Unitroller Poller',
              );
              this.ibControl.updateItem(
                'lastBlockNumberUnitrollerPoller',
                tx.blockNumber,
              );
              this.firstAccountsPollFinished = true;
            }, 200);
          }
        });
      });
  }

  unsubscribeWs() {
    this.accountsSubsciption.unsubscribe((error, success) => {
      if (success) {
        this.logger.debug('IB: Successfully unsubscribed from logs.');
      }
    });
  }

  async getAccountBalanceFromToken(account: string, iToken: string) {
    return this.tokenContract[iToken].methods
      .getAccountSnapshot(account)
      .call();
  }

  async pollAllAccounts() {
    const accounts = await this.ibAccounts.findAllSortedLimited();
    this.logger.debug(`IB: Polling ${accounts.length} accounts balances`);
    const promises: Record<string, Record<string, Promise<any>>> = {};

    for (const account of accounts) {
      if (!promises[account._id]) {
        promises[account._id] = {};
      }
      for (const token of account.tokens) {
        promises[account._id][token.address] = this.getAccountBalanceFromToken(
          account._id,
          token.address,
        );
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
              supply_balance_underlying: parseFloat(res[1]),
            });
          } catch (error) {
            this.logger.error(error.message);
          }
        }
        updatedAccounts.push({ address: accountId, _id: accountId, tokens });
      }
    };

    await promiseExecution();

    this.logger.debug('IB: Finished polling accounts balances');
    // While I dont develop prices poll I pass the tokens obj
    await this.ibAccounts.calculateHealthAndStore(
      updatedAccounts,
      this.tokenObj,
      this.tokenObj,
    );
    return true;
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
