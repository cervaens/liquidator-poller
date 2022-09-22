import { Injectable, Logger } from '@nestjs/common';
import { IronBankToken } from '../../mongodb/ib-token/classes/IronBankToken';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';

@Injectable()
export class IronbankPollerService {
  constructor(
    private readonly httpService: HttpService,
    private readonly amqpConnection: AmqpConnection,
    private readonly provider: Web3ProviderService,
  ) {}
  private readonly logger = new Logger(IronbankPollerService.name);

  async fetchIBtokens(withConfig: Record<string, any>) {
    const json = await this.fetch('itoken', withConfig);

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
      json.data.map((i: Record<string, any>) => new IronBankToken(i)) || [];

    const tokenObj = {};
    for (const token of tokens) {
      tokenObj[token.symbol] = token;
    }
    this.amqpConnection.publish('liquidator-exchange', 'itokens-polled', {
      ...tokenObj,
    });

    return {
      error: json.error,
      tokens,
    };
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
