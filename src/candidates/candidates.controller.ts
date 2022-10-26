import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { QueryLiquidateDto, QueryCandidateDto, EnableDto } from '../app.dto';
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

  @ApiOperation({
    description: `Get all candidates from all protocols or a specific protocol or for a specific account`,
  })
  @Get()
  getCandidates(
    @Query() query: QueryCandidateDto,
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

  @ApiOperation({
    description: `Clear all candidates so that they're reloaded`,
  })
  @Get('reset')
  resetCandidates(): string {
    this.amqpConnection.publish('liquidator-exchange', 'candidates-reset', {});
    return 'Candidates are being refreshed';
  }

  @ApiOperation({ description: 'Liquidate a specific account in a protocol' })
  @Post('liquidate')
  liquidateCandidate(@Body() body: QueryLiquidateDto): string {
    if (body.force) {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'liquidations-clear',
        {},
      );
      setTimeout(() => {
        this.amqpConnection.publish(
          'liquidator-exchange',
          'trigger-liquidations',
          {
            account: body.account || '',
            protocol: body.protocol || '',
          },
        );
      }, 1000);
    } else {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'trigger-liquidations',
        {
          account: body.account || '',
          protocol: body.protocol || '',
        },
      );
    }

    return `Triggered liquidations for ${
      body.account || body.protocol ? JSON.stringify(body) : 'all protocols'
    }`;
  }

  @ApiOperation({
    description: 'Enable/Disable same repay/seize token liquidation',
  })
  @Post('same-token/')
  setRealTxs(@Body() body: EnableDto): string {
    if (!body || typeof body.enabled !== 'boolean') {
      return 'Please include boolean enable.';
    }
    this.logger.debug(`Setting same token candidates to ${body.enabled}`);
    this.amqpConnection.publish('liquidator-exchange', 'set-same-token', {
      enabled: body.enabled,
    });

    return `Same token candidates are now ${
      body.enabled ? 'enabled' : 'disabled'
    }`;
  }
}
