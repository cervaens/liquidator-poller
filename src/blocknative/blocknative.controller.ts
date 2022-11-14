import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AppService } from 'src/app.service';
import { BlocknativeService } from './blocknative.service';

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
    this.logger.debug(`Mempool data received for aggregator ${body.to}`);
    this.blocknativeService.processData(body);

    return true;
  }
}
