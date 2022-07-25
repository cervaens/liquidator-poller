import { Controller, Logger } from '@nestjs/common';

import { CompoundAccountsService } from './compound-accounts.service';
// import CtokenDto from './dto/create-ctoken.dto';

@Controller('compound-accounts')
export class CompoundAccountsController {
  constructor(
    private readonly compoundAccountsService: CompoundAccountsService,
  ) {}
  private readonly logger = new Logger(CompoundAccountsController.name);
}
