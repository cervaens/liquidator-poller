import { Body, Controller, Logger } from '@nestjs/common';
import { IronBankToken } from './classes/IronBankToken';
import { IbTokenService } from './ib-token.service';

@Controller('ib-token')
export class IbTokenController {
  constructor(private readonly ctokenService: IbTokenService) {}
  private readonly logger = new Logger(IbTokenController.name);

  async createMany(@Body() ctokens: Array<IronBankToken>) {
    return await this.ctokenService.createMany(ctokens);
  }
}
