import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
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

        this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
          action: 'insert',
          ids: candidateIds,
        });
      }
    }, this.candidatesTimeout);

    // Cleaning all candidates list as some workers might have disconnected
    // or some candidates are not anymore
    setInterval(() => {
      // Have to comment the following as if its the master going down
      // it will take sometime before other worker becomes master
      // if (this.appService.amItheMaster()) {
      const timestamp = new Date().getTime() - this.candidatesTimeout - 2000;
      this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
        action: 'deleteBelowTimestamp',
        timestamp,
      });
      // }
    }, this.candidatesTimeout);
  }
  @Get()
  getCandidates(): Record<string, Record<string, any>> {
    return this.candidatesService.getCandidates();
  }

  @Get('liquidate')
  liquidateCandidates(@Query() query: Record<string, any>): string {
    if (query.force === 'true') {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'liquidations-clear',
        {},
      );
    }
    this.amqpConnection.publish(
      'liquidator-exchange',
      'trigger-liquidations',
      {},
    );
    return 'Triggered liquidations';
  }

  @Get('liquidate/:account')
  liquidateCandidate(@Param() params): string {
    const candidates = this.candidatesService.getCandidates();

    this.logger.debug(`Liquidating ${params.account}`);

    const liqCand = {
      repayCToken: candidates[params.account].liqBorrow.cTokenAddress,
      amount: candidates[params.account].getLiqAmount(),
      seizeCToken: candidates[params.account].liqCollateral.cTokenAddress,
      borrower: candidates[params.account].address,
      profitUSD: candidates[params.account].profitUSD,
    };

    this.amqpConnection.publish('liquidator-exchange', 'liquidate-many', [
      liqCand,
    ]);

    return `Liquidating ${params.account}`;
  }

  @Get('ready-for-liquidation')
  getReadyForLiq(): Array<CompoundAccount> {
    return this.candidatesService.getCandidatesForLiquidation();
  }
}
