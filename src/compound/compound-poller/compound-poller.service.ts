import { Injectable, Logger } from '@nestjs/common';
import { CompoundToken } from '../../mongodb/ctoken/classes/CompoundToken';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
@Injectable()
export class CompoundPollerService {
  constructor(
    private readonly httpService: HttpService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  private readonly logger = new Logger(CompoundPollerService.name);
  // // This one is only for delete candidates purpose (not very important)
  // private activeCandidatesList: Array<string> = [];
  private initOngoing = false;
  private protocol = 'Compound';
  private tokenObj: Record<string, any> = {};
  private cTokenPrices: Record<string, Record<string, number>> = {};

  async sleep(millis: number) {
    return new Promise((resolve) => setTimeout(resolve, millis));
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-polled',
  })
  async updatePricesHandler(msg: Record<string, any>) {
    if (msg.protocol !== this.protocol) {
      return;
    }
    if (!msg.init) {
      this.cTokenPrices = { ...this.cTokenPrices, ...msg.prices };
    } else {
      this.cTokenPrices = { ...msg.prices, ...this.cTokenPrices };
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-updated',
  })
  public async pricesUpdated(msg: Record<string, any>) {
    for (const priceObj of msg.prices) {
      if (
        !this.cTokenPrices[priceObj.underlyingAddress] ||
        this.cTokenPrices[priceObj.underlyingAddress].blockNumber <
          priceObj.blockNumber
      ) {
        this.cTokenPrices[priceObj.underlyingAddress] = {
          blockNumber: priceObj.blockNumber,
          price: priceObj.price,
        };
      }
    }
  }

  async fetchCtokens(withConfig: Record<string, any>) {
    const json = await this.fetch('ctoken', withConfig);

    if (json.error || json.errors) {
      this.logger.warn(
        'Fetch CTokens failed: ' +
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
      (json.data &&
        json.data.cToken.map(
          (i: Record<string, any>) => new CompoundToken(i),
        )) ||
      [];

    for (const token of tokens) {
      this.tokenObj[token.symbol] = token;
    }
    this.amqpConnection.publish('liquidator-exchange', 'tokens-polled', {
      tokens: this.tokenObj,
      protocol: this.protocol,
    });

    return {
      error: json.error,
      tokens,
    };
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'fetch-accounts',
    queue: 'fetchaccounts',
  })
  async fetchAccounts(msg: Record<string, boolean>) {
    if (
      !this.tokenObj ||
      !this.cTokenPrices ||
      Object.keys(this.tokenObj).length === 0 ||
      Object.keys(this.cTokenPrices).length === 0
    ) {
      this.logger.warn(
        'Fetch accounts cancelled. Not enough token/prices info. ',
      );
      return;
    }
    const timestamp = new Date().getTime();

    const options = {
      page_size: 50,
      // Adding this one which reduces the returned results in around 700 accounts
      'max_health[value]':
        process.env.COMPOUND_POLLING_ACCOUNT_MAX_HEALTH || 1.3,
      'min_borrow_value_in_eth[value]':
        process.env.COMPOUND_POLLING_ACCOUNT_MIN_BORROW_ETH || 0.09,
    };
    const firstPage = await this.fetch('account', {
      ...options,
      page_number: 1,
    });

    if (firstPage.error || firstPage.errors) {
      this.logger.warn(
        'Fetch AccountService failed: ' +
          firstPage.error +
          ' ' +
          (firstPage.error.response && firstPage.error.response.statusText),
      );
    }

    this.amqpConnection.publish('liquidator-exchange', 'accounts-polled', {
      accounts: firstPage.data && firstPage.data.accounts,
      init: msg.init,
      timestamp,
      cTokens: this.tokenObj,
      cTokenPrices: this.cTokenPrices,
    });

    const pageCount =
      firstPage.data &&
      firstPage.data.pagination_summary &&
      firstPage.data.pagination_summary.total_pages;

    const promises = [];
    for (let i = 2; i <= pageCount; i++) {
      promises.push(
        this.fetch('account', {
          ...options,
          page_number: i,
        }),
      );
    }

    const promiseExecution = async () => {
      // let promisesCandidateIds = [];
      for (const promise of promises) {
        try {
          const res = await promise;

          this.amqpConnection.publish(
            'liquidator-exchange',
            'accounts-polled',
            {
              accounts: res.data && res.data.accounts,
              init: msg.init,
              timestamp,
              cTokens: this.tokenObj,
              cTokenPrices: this.cTokenPrices,
            },
          );
        } catch (error) {
          this.logger.error(error.message);
        }
      }
      // return promisesCandidateIds;
    };

    await promiseExecution();

    // const removeIds = this.activeCandidatesList.filter(
    //   (x) => !candidateIds.includes(x),
    // );

    // if (removeIds.length > 0) {
    //   this.amqpConnection.publish('liquidator-exchange', 'candidates-delete', {
    //     ids: removeIds,
    //   });
    // }
    // this.activeCandidatesList = candidateIds;

    this.logger.debug(
      ` fetchAccounts execution time: ${new Date().getTime() - timestamp} ms`,
    );
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
          process.env.COMPOUND_ENDPOINT + `/${endpoint}?` + urlParams,
          params,
        ),
      );

      return json;
    } catch (error) {
      return { error: error };
    }
  }
}
