import { Injectable, Logger } from '@nestjs/common';
import { CompoundToken } from './classes/CompoundToken';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
@Injectable()
export class CompoundPollerService {
  constructor(
    private readonly httpService: HttpService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  private readonly logger = new Logger(CompoundPollerService.name);
  getHello(): string {
    return 'Hello World!';
  }

  async sleep(millis: number) {
    return new Promise((resolve) => setTimeout(resolve, millis));
  }

  async fetchCtokens(withConfig: Record<string, any>) {
    const json = await this.fetch('ctoken', withConfig);

    return {
      error: json.error,
      tokens: json.data.cToken.map(
        (i: Record<string, any>) => new CompoundToken(i),
      ),
    };
  }

  async fetchAccounts() {
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
    this.amqpConnection.publish('liquidator-exchange', 'accounts-polled', {
      accounts: firstPage.data && firstPage.data.accounts,
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
      for (const promise of promises) {
        try {
          const res = await promise;

          this.amqpConnection.publish(
            'liquidator-exchange',
            'accounts-polled',
            {
              accounts: res.data.accounts,
            },
          );
        } catch (error) {
          this.logger.error(error.message);
        }
      }
    };

    await promiseExecution();
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
