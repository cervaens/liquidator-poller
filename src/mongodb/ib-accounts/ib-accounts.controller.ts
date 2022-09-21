import { Controller, Logger } from '@nestjs/common';
import { IbAccountsService } from './ib-accounts.service';

@Controller('ib-accounts')
export class IbAccountsController {
  constructor(private readonly ibAccountsService: IbAccountsService) {}
  private readonly logger = new Logger(IbAccountsController.name);

  async accountEnterMarket(account: string, market: string) {
    return await this.ibAccountsService.accountEnterMarket(account, market);
  }
}
