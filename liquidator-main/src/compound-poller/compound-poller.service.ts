import { Injectable } from '@nestjs/common';
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
    let i = 1;
    let pageCount = 0;

    let result;
    do {
      // Sleep on each iter to avoid API rate limiting
      await this.sleep(100);

      result = await this.fetch('account', {
        page_number: i,
        page_size: 300,
        'max_health[value]': 1.1, // Adding this one which reduces the returned results in around 700 accounts
        'min_borrow_value_in_eth[value]': 0.09,
      });
      if (result.error) {
        console.warn('Fetch AccountService failed: ' + result.error.toString());
        continue;
      }

      pageCount = result.pagination.total_pages;
      i++;

      this.amqpConnection.publish('liquidator-exchange', 'test-msg', {
        accounts: result.accounts,
      });

      // send result.accounts
    } while (i <= pageCount);

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
