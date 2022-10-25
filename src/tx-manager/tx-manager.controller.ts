import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { TxManagerService } from './tx-manager.service';

@Controller('tx-manager')
export class TxManagerController {
  constructor(
    private readonly txManagerService: TxManagerService,
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

  @Post('real-txs/')
  setRealTxs(@Body() body): string {
    if (!body || typeof body.enabled !== 'boolean') {
      return 'Please include boolean enable.';
    }
    this.logger.debug(`Setting Real transactions to ${body.enabled}`);
    this.txManagerService.setRealTxs(body.enabled);

    return `Real transactions are now ${body.enabled ? 'enabled' : 'disabled'}`;
  }

  @Get('current-liquidations')
  currentLiquidations(): Record<string, Record<string, any>> {
    return this.txManagerService.getCurrentLiquidations();
  }

  @Post('clear-liquidations')
  liquidationsClear(@Body() body): string {
    this.logger.debug(`Clearing liquidations list.`);
    const account = body.account || '';
    const protocol = body.protocol || '';

    this.amqpConnection.publish('liquidator-exchange', 'liquidations-clear', {
      account,
      protocol,
    });

    return `Cleared liquidations list`;
  }

  @Post('protocol-status')
  protocolStatus(@Body() body): string {
    if (!body || !body.protocol || typeof body.enabled !== 'boolean') {
      return 'Please include the "protocol" and boolean "enabled".';
    }
    this.logger.debug(
      `Changing protocol ${body.protocol} enabled to ${body.enabled}`,
    );
    this.amqpConnection.publish('liquidator-exchange', 'tx-protocol-status', {
      protocol: body.protocol,
      enabled: body.enabled,
    });

    return `Changed protocol ${body.protocol} enabled to ${body.enabled}`;
  }
}
