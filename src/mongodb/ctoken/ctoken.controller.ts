import { Body, Controller, Param, Logger } from '@nestjs/common';

import { CtokenService } from './ctoken.service';
import ParamsWithId from '../utils/paramsWithId';
import { CompoundToken } from './classes/CompoundToken';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Controller('ctoken')
export class CtokenController {
  constructor(
    private readonly ctokenService: CtokenService,
    private readonly amqpConnection: AmqpConnection,
  ) {}
  private readonly logger = new Logger(CtokenController.name);
  private protocol = 'Compound';

  async onApplicationBootstrap(): Promise<void> {
    // At start time of the worker we get the itokens from db if they exist
    setTimeout(async () => {
      const iTokens = await this.ctokenService.findAll();
      if (iTokens.length > 0) {
        const tokenObj = {};
        for (const token of iTokens) {
          tokenObj[token.symbol] = token;
        }
        this.amqpConnection.publish('liquidator-exchange', 'tokens-polled', {
          tokens: tokenObj,
          protocol: this.protocol,
        });
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));
  }

  async getAllCtokens() {
    return this.ctokenService.findAll();
  }

  async getCtokensWithQuery(
    filter: Record<string, string>,
    output: Record<string, number>,
  ) {
    return this.ctokenService.findWithParams(filter, output);
  }

  async getCtoken(@Param() { id }: ParamsWithId) {
    return this.ctokenService.findOne(id);
  }

  async createMany(@Body() ctokens: Array<CompoundToken>) {
    return await this.ctokenService.createMany(ctokens);
  }

  async updateCtokenPriceFromAddressOrSymbol(
    address: string,
    symbol: string,
    price: number,
    extraUpdate: Record<string, any>,
  ) {
    return this.ctokenService.updateCtokenPriceFromAddressOrSymbol(
      address,
      symbol,
      price,
      extraUpdate,
    );
  }

  async updateCtokensPrices(tokenPrices: Record<string, Record<string, any>>) {
    const promises = [];
    for (const token of Object.keys(tokenPrices)) {
      promises.push(
        this.updateCtokenPriceFromAddressOrSymbol(
          token,
          null,
          parseInt(tokenPrices[token].price),
          null,
        ),
      );
    }

    return Promise.all(promises);
  }
}
