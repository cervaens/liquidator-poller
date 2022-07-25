import { Body, Controller, Param, Logger } from '@nestjs/common';

import { CtokenService } from './ctoken.service';
import ParamsWithId from '../utils/paramsWithId';
import CtokenDto from './dto/create-ctoken.dto';
import { CompoundToken } from './classes/CompoundToken';

@Controller('ctoken')
export class CtokenController {
  constructor(private readonly ctokenService: CtokenService) {}
  private readonly logger = new Logger(CtokenController.name);

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

  async createCtoken(@Body() ctoken: CtokenDto) {
    return this.ctokenService.create(ctoken);
  }

  async createMany(@Body() ctokens: Array<CompoundToken>) {
    return await this.ctokenService.createMany(ctokens);
  }

  async updateCtoken(@Param() { id }: ParamsWithId, @Body() ctoken: CtokenDto) {
    return this.ctokenService.update(id, ctoken);
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

  async updateCtokensPrices(tokenPrices: Record<string, string>) {
    const promises = [];
    for (const token of Object.keys(tokenPrices)) {
      promises.push(
        this.updateCtokenPriceFromAddressOrSymbol(
          null,
          token,
          parseInt(tokenPrices[token]),
          null,
        ),
      );
    }

    return Promise.all(promises);
  }
}
