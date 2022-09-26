import { Controller, Logger } from '@nestjs/common';
import { IbAccountsService } from './ib-accounts.service';

@Controller('ib-accounts')
export class IbAccountsController {
  constructor(private readonly ibAccountsService: IbAccountsService) {}
  private readonly logger = new Logger(IbAccountsController.name);

  async accountEntersMarket(
    account: string,
    market: string,
    blockNumber: number,
  ) {
    return await this.ibAccountsService.accountEntersMarket(
      account,
      market,
      blockNumber,
    );
  }

  async accountExitsMarket(
    account: string,
    market: string,
    blockNumber: number,
  ) {
    return await this.ibAccountsService.accountExitsMarket(
      account,
      market,
      blockNumber,
    );
  }
}
