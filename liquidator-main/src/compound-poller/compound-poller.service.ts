import { Injectable } from '@nestjs/common';
import { CompoundToken } from './classes/CompoundToken';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class CompoundPollerService {
  constructor(private readonly httpService: HttpService) {}
  getHello(): string {
    return 'Hello World!';
  }

  async fetch(withConfig: Record<string, any>) {
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
          process.env.COMPOUND_ENDPOINT + '/ctoken?' + urlParams,
          params,
        ),
      );

      return {
        error: json.error,
        tokens: json.data.cToken.map(
          (i: Record<string, any>) => new CompoundToken(i),
        ),
      };
    } catch (error) {
      return { error: error };
    }
  }
}
