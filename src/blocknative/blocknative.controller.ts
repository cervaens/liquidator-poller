import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBasicAuth, ApiOperation } from '@nestjs/swagger';
import { BlockNativeDto, EnableDto } from 'src/app.dto';
import { AppService } from 'src/app.service';
import { ACLGuard } from 'src/auth/acl.guard';
import { BlocknativeService } from './blocknative.service';
@ApiBasicAuth()
@Controller('blocknative')
export class BlocknativeController {
  constructor(
    private readonly blocknativeService: BlocknativeService,
    private readonly amqpConnection: AmqpConnection,
    private readonly appService: AppService,
  ) {}
  private readonly logger = new Logger(BlocknativeController.name);

  private methods = {
    Mint: '0xa0712d68',
    Transmit: '0xc9807539',
  };

  async onApplicationBootstrap(): Promise<void> {
    // At init the master will start a poll
    this.blocknativeService.getValidators();

    setInterval(async () => {
      this.blocknativeService.getValidators();
    }, parseInt(process.env.BLOCKNATIVE_AGG_POLL_PERIOD));

    setInterval(() => {
      if (this.appService.amItheMaster()) {
        this.amqpConnection.publish(
          'liquidator-exchange',
          'waiter-candidates-list',
          {
            waiterCandidates: this.blocknativeService.waiterCandidates,
          },
        );
      }
    }, 60000);
  }

  @ApiOperation({
    description: 'get mempool data',
  })
  @Post('mempool/')
  memPool(@Body() body: BlockNativeDto): boolean {
    if (!body || body.error) {
      return false;
    }
    this.logger.debug(
      `Mempool data received for aggregator ${JSON.stringify(body.to)}`,
    );
    const method = body.input.substring(0, 10);
    if (method === this.methods.Transmit) {
      this.blocknativeService.processTransmit(body);
    } else if (method === this.methods.Mint) {
    }

    return true;
  }

  @ApiOperation({
    description: 'get mempool data',
  })
  @Get('strong-candidates/')
  @UseGuards(ACLGuard)
  getStrongCandidates(): Record<string, any> {
    return this.blocknativeService.strongCandidates;
  }

  @ApiOperation({
    description: 'get mempool data',
  })
  @Get('waiter-candidates/')
  @UseGuards(ACLGuard)
  getWaiterCandidates(): Record<string, any> {
    return this.blocknativeService.waiterCandidates;
  }

  @ApiOperation({
    description: `Enables/Disables blocknative module.`,
  })
  @Post('enable')
  @UseGuards(ACLGuard)
  protocolStatus(@Body() body: EnableDto): string {
    if (!body || typeof body.enabled !== 'boolean') {
      return 'Please include boolean "enabled".';
    }
    this.logger.debug(`Changing enabled to ${body.enabled}`);
    this.amqpConnection.publish('liquidator-exchange', 'blocknative-status', {
      enabled: body.enabled,
    });

    return `Changed enabled to ${body.enabled}`;
  }
}
