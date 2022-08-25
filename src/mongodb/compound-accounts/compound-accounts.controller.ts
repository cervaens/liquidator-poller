import { Controller } from '@nestjs/common';

import { CompoundAccountsService } from './compound-accounts.service';

@Controller('compound-accounts')
export class CompoundAccountsController {
  constructor(
    private readonly compoundAccountsService: CompoundAccountsService,
  ) {}
}
