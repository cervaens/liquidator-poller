import { Injectable, Logger } from '@nestjs/common';
import { CompoundToken } from '../mongodb/ctoken/classes/CompoundToken';
// import { CompoundAccount } from '../mongodb/compound-accounts/classes/CompoundAccount';
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

  // Init is necessary so that the activeCandidateList is cleared
  // to re-spread all candidates including the new joined app
  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'accounts-polling-init',
  })
  async setInitOngoing(msg: Record<string, boolean>) {
    this.initOngoing = msg.initOngoing;
  }

  isInitOngoing(): boolean {
    return this.initOngoing;
  }

  async sleep(millis: number) {
    return new Promise((resolve) => setTimeout(resolve, millis));
  }

  async fetchCtokens(withConfig: Record<string, any>) {
    const json = await this.fetch('ctoken', withConfig);
    const tokens = json.data.cToken.map(
      (i: Record<string, any>) => new CompoundToken(i),
    );

    const tokenObj = {};
    for (const token of tokens) {
      tokenObj[token.symbol] = token;
    }
    this.amqpConnection.publish('liquidator-exchange', 'ctokens-polled', {
      ...tokenObj,
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
    const timestamp = new Date().getTime();
    if (msg.init) {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'accounts-polling-init',
        {
          initOngoing: true,
        },
      );
    }
    const options = {
      page_size: 100,
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
        'Fetch AccountService failed: ' + firstPage.error + firstPage.errors,
      );
    }
    // const accounts =
    //   firstPage.data &&
    //   firstPage.data.accounts &&
    //   firstPage.data.accounts.map(
    //     (i: Record<string, any>) => new CompoundAccount(i),
    //   );
    // let candidateIds = accounts
    //   .filter((account: CompoundAccount) => account.isCandidate())
    //   .map((account) => account._id);
    this.amqpConnection.publish('liquidator-exchange', 'accounts-polled', {
      accounts: firstPage.data && firstPage.data.accounts,
      init: msg.init,
      timestamp,
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
          // const accounts =
          //   res.data &&
          //   res.data.accounts &&
          //   res.data.accounts.map(
          //     (i: Record<string, any>) => new CompoundAccount(i),
          //   );
          // promisesCandidateIds = promisesCandidateIds.concat(
          //   accounts
          //     .filter((account: CompoundAccount) => account.isCandidate())
          //     .map((account) => account._id),
          // );
          this.amqpConnection.publish(
            'liquidator-exchange',
            'accounts-polled',
            {
              accounts: res.data && res.data.accounts,
              init: msg.init,
              timestamp,
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

    if (msg.init) {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'accounts-polling-init',
        {
          initOngoing: false,
        },
      );
    }
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
