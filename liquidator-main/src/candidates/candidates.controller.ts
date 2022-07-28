import { Controller, Get } from '@nestjs/common';
import { CompoundAccount } from 'src/mongodb/compound-accounts/classes/CompoundAccount';
import { CandidatesService } from './candidates.service';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  getCandidates(): Record<string, Record<string, any>> {
    return this.candidatesService.getCandidates();
  }

  @Get('ready-for-liquidation')
  getReadyForLiq(): Array<CompoundAccount> {
    return this.candidatesService.getCandidatesForLiquidation();
  }
}
