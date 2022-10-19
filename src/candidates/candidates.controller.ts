import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
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
      const time = new Date().getTime();
      const candidates = this.candidatesService.getCandidates();
      for (const protocol of Object.keys(candidates)) {
        if (this.candidatesService.getIsNextInit() && protocol === 'Compound') {
          continue;
        }
        const candidateIds = {};
        Object.keys(candidates[protocol]).forEach((id) => {
          candidateIds[id] = time;
        });

        this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
          action: 'insert',
          ids: candidateIds,
          protocol,
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
  getCandidates(
    @Query() query: Record<string, any>,
  ): Array<Record<string, Record<string, any>>> {
    const candidates = this.candidatesService.getCandidates();
    let retArray = [];

    for (const protocol of Object.keys(candidates)) {
      if (query.protocol && query.protocol !== protocol) {
        continue;
      }
      if (!query.account) {
        retArray = retArray.concat(Object.values(candidates[protocol]));
      } else if (candidates[protocol][query.account]) {
        retArray = retArray.concat(candidates[protocol][query.account]);
      }
    }
    return retArray;
  }

  @Get('reset')
  resetCandidates(): string {
    this.amqpConnection.publish('liquidator-exchange', 'candidates-reset', {});
    return 'Candidates are being refreshed';
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
    setTimeout(() => {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'trigger-liquidations',
        {
          protocol: query.protocol || '',
        },
      );
    }, 1000);
    return 'Triggered liquidations';
  }

  @Post('liquidate')
  liquidateCandidate(@Body() body): string {
    if (!body || !body.account || !body.protocol) {
      return 'Please add account and protocol.';
    }

    this.amqpConnection.publish('liquidator-exchange', 'trigger-liquidations', {
      account: body.account,
      protocol: body.protocol,
    });

    return `Trying to liquidate ${body.account}`;
  }

  @Post('same-token/')
  setRealTxs(@Body() body): string {
    if (!body || typeof body.enabled !== 'boolean') {
      return 'Please include boolean enable.';
    }
    this.logger.debug(`Setting same token candidates to ${body.enabled}`);
    this.candidatesService.setSameTokenCandidates(body.enabled);

    return `Same token candidates are now ${
      body.enabled ? 'enabled' : 'disabled'
    }`;
  }

  @Get('ready-for-liquidation')
  getReadyForLiq(): Array<CompoundAccount> {
    return this.candidatesService.getCandidatesForLiquidation('Compound');
  }
}
