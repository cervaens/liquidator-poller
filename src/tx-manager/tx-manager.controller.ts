import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
// import { TxManagerService } from './tx-manager.service';

@Controller('tx-manager')
export class TxManagerController {
  constructor(
    // private readonly txManagerService: TxManagerService,
    private readonly amqpConnection: AmqpConnection,
  ) {}
  private readonly logger = new Logger(TxManagerController.name);

  @Post('blacklist/')
  liquidateCandidate(@Body() body): string {
    if (!body || !body.protocol || !body.account) {
      return 'Please include account and protocol.';
    }
    const addToBlackList = {};
    addToBlackList[body.protocol] = {};
    addToBlackList[body.protocol][body.account] = {
      status: 'ongoing',
      timestamp: Infinity,
    };
    this.logger.debug(`Adding account ${body.account} to txs blacklist`);

    this.amqpConnection.publish(
      'liquidator-exchange',
      'liquidations-called',
      addToBlackList,
    );

    return `Blacklisted ${body.account}`;
  }

  @Get('clear-liquidations')
  liquidationsClear(): string {
    this.logger.debug(`Clearing liquidations list.`);

    this.amqpConnection.publish(
      'liquidator-exchange',
      'liquidations-clear',
      {},
    );

    return `Cleared liquidations list`;
  }
}
