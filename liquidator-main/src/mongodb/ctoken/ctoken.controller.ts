import {
  Body,
  Controller,
  //   Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';

import { CtokenService } from './ctoken.service';
import ParamsWithId from '../utils/paramsWithId';
import CtokenDto from './dto/create-ctoken.dto';
import { CompoundToken } from '../../compound-poller/classes/CompoundToken';

@Controller('ctoken')
export class CtokenController {
  constructor(private readonly ctokenService: CtokenService) {}

  @Get()
  async getAllCtokens() {
    return this.ctokenService.findAll();
  }

  @Get(':id')
  async getCtoken(@Param() { id }: ParamsWithId) {
    return this.ctokenService.findOne(id);
  }

  @Post()
  async createCtoken(@Body() ctoken: CtokenDto) {
    return this.ctokenService.create(ctoken);
  }

  @Post()
  async createMany(@Body() ctokens: Array<CompoundToken>) {
    return this.ctokenService.createMany(ctokens);
  }

  //   @Delete(':id')
  //   async deleteCtoken(@Param() { id }: ParamsWithId) {
  //     return this.ctokenService.delete(id);
  //   }

  @Put(':id')
  async updateCtoken(@Param() { id }: ParamsWithId, @Body() ctoken: CtokenDto) {
    return this.ctokenService.update(id, ctoken);
  }
}
