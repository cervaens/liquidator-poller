import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBasicAuth, ApiOperation } from '@nestjs/swagger';
import { ACLGuard } from 'src/auth/acl.guard';
import {
  QueryLiquidateDto,
  QueryCandidateDto,
  EnableDto,
  ProfitDto,
} from '../app.dto';
import { CandidatesService } from './candidates.service';

@ApiBasicAuth()
@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly amqpConnection: AmqpConnection,
  ) {}
  private readonly logger = new Logger(CandidatesController.name);
  private candidatesTimeout =
    parseInt(process.env.PERIOD_CLEAN_CANDIDATES) || 4000;

  private candidatesUpdateTolerance =
    parseInt(process.env.NON_UPDATED_CANDIDATE_TOLERANCE) || 190000;

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
          // Deleting non updated candidades, important for Compound
          // as if accounts are repaied they wont be returned from the API
          if (
            time - candidates[protocol][id].lastUpdated >
            this.candidatesUpdateTolerance
          ) {
            this.candidatesService.deleteCandidate(protocol, id);
          } else {
            candidateIds[id] = time;
            if (candidates[protocol][id].isStrongCandidate()) {
              this.amqpConnection.publish(
                'liquidator-exchange',
                'strong-candidate',
                {
                  address: id,
                  time,
                  tokens: candidates[protocol][id].tokens,
                  protocol,
                },
              );
            }
          }
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
  @UseGuards(ACLGuard)
  getCandidates(
    @Req() req,
    @Query() query: QueryCandidateDto,
  ): string | Array<Record<string, Record<string, any>>> {
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
  @UseGuards(ACLGuard)
  resetCandidates(): string {
    this.amqpConnection.publish('liquidator-exchange', 'candidates-reset', {});
    return 'Candidates are being refreshed';
  }

  @ApiOperation({ description: 'Liquidate a specific account in a protocol' })
  @Post('liquidate')
  @UseGuards(ACLGuard)
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
  @UseGuards(ACLGuard)
  setSameToken(@Body() body: EnableDto): string {
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

  @ApiOperation({
    description:
      "Sets a candidate's minimum profit in USD to be cosidered for liquidation",
  })
  @Post('set-profit/')
  @UseGuards(ACLGuard)
  setProfit(@Body() body: ProfitDto): string {
    if (!body || typeof body.profit !== 'number') {
      return 'Please include a valid profit.';
    }
    this.logger.debug(`Setting minimum profit to ${body.profit} USD`);
    this.amqpConnection.publish('liquidator-exchange', 'set-min-profit', {
      profit: body.profit,
    });

    return `Minimum profit is now ${body.profit} USD`;
  }
}
