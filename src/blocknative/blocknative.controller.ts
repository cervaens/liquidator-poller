import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBasicAuth, ApiOperation } from '@nestjs/swagger';
import { EnableDto } from 'src/app.dto';
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

  async onApplicationBootstrap(): Promise<void> {
    // At init the master will start a poll
    this.logger.debug('Waiting to listen from other workers...');

    let amITheMaster = false;
    setInterval(async () => {
      if (this.appService.amItheMaster() && !amITheMaster) {
        this.blocknativeService.getValidators();
        amITheMaster = true;
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS) + 1000);
  }

  @ApiOperation({
    description: 'get mempool data',
  })
  @Post('mempool/')
  memPool(@Body() body): boolean {
    if (!body) {
      return false;
    }
    this.logger.debug(
      `Mempool data received for aggregator ${JSON.stringify(body.to)}`,
    );
    this.blocknativeService.processData(body);

    return true;
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
