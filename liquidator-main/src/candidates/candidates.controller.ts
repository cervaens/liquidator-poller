import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Controller, Get, Logger } from '@nestjs/common';
import { CompoundAccount } from 'src/mongodb/compound-accounts/classes/CompoundAccount';
import { CandidatesService } from './candidates.service';

@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly amqpConnection: AmqpConnection,
  ) {}
  private readonly logger = new Logger(CandidatesController.name);
  private candidatesTimeout =
    parseInt(process.env.PERIOD_CLEAN_CANDIDATES) || 4000;

  async onApplicationBootstrap(): Promise<void> {
    // We have to periodicaly send the full module list of candidates
    // so that we can identify disconnected workers that deprecated
    // their list of candidates
    setInterval(() => {
      if (!this.candidatesService.getIsNextInit()) {
        const time = new Date().getTime();
        const candidateIds = {};
        Object.keys(this.candidatesService.getCandidates()).forEach((id) => {
          candidateIds[id] = time;
        });
        this.logger.debug(
          'Nr. Candidates: ' +
            Object.keys(this.candidatesService.getCandidates()).length,
        );
        this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
          action: 'insert',
          ids: candidateIds,
        });
      }
    }, this.candidatesTimeout - 500);
  }
  @Get()
  getCandidates(): Record<string, Record<string, any>> {
    return this.candidatesService.getCandidates();
  }

  @Get('liquidate')
  liquidateCandidates(): Record<string, any> {
    const candidates = this.candidatesService.getCandidatesForLiquidation();
    const cand = candidates.filter(
      (candidate) =>
        candidate.address === '0x3fc33c9d7758bb59d3488c569a2bce0ffbd01366',
    );
    const liqCand = {
      repayCToken: cand[0].liqBorrow.cTokenAddress,
      // || '0x0000000000000000000000000000000000000000',
      amount: cand[0].getLiqAmount(),
      seizeCToken: cand[0].liqCollateral.cTokenAddress,
      borrower: cand[0].address,
    };
    this.amqpConnection.publish('liquidator-exchange', 'liquidate', liqCand);
    return liqCand;
  }

  @Get('ready-for-liquidation')
  getReadyForLiq(): Array<CompoundAccount> {
    return this.candidatesService.getCandidatesForLiquidation();
  }
}
