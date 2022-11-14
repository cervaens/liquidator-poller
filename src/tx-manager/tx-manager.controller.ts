import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  EnableDto,
  ProtocolEnableDto,
  QueryCandidateDto,
  QueryCustomTxDto,
} from 'src/app.dto';
import { TxManagerService } from './tx-manager.service';

@Controller('tx-manager')
export class TxManagerController {
  constructor(
    private readonly txManagerService: TxManagerService,
    private readonly amqpConnection: AmqpConnection,
  ) {}
  private readonly logger = new Logger(TxManagerController.name);

  @ApiOperation({
    description: `Adds an account from a specific protocol to the liquidations blacklist. The account won't be liquidated till it is manually unblacklisted`,
  })
  @Post('blacklist/')
  blackListAccount(@Body() body: QueryCandidateDto): string {
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

  @ApiOperation({
    description: `Enables/Disables the creation of real liquidation transactions, versus only writing in logs that a tx would be created.`,
  })
  @Post('real-txs/')
  setRealTxs(@Body() body: EnableDto): string {
    if (!body || typeof body.enabled !== 'boolean') {
      return 'Please include boolean enable.';
    }
    this.logger.debug(`Setting Real transactions to ${body.enabled}`);
    this.amqpConnection.publish('liquidator-exchange', 'set-real-txs', {
      enabled: body.enabled,
    });

    return `Real transactions are now ${body.enabled ? 'enabled' : 'disabled'}`;
  }

  @ApiOperation({
    description: `Gets all current ongoing/processed liquidations`,
  })
  @Get('current-liquidations')
  currentLiquidations(): Record<string, Record<string, any>> {
    return this.txManagerService.getCurrentLiquidations();
  }

  @ApiOperation({
    description: `Clears the liquidations blacklist or removes an account for a specific protocol from the liquidations blacklist.`,
  })
  @Post('unblacklist')
  liquidationsClear(@Body() body: QueryCandidateDto): string {
    this.logger.debug(`Clearing liquidations list.`);
    const account = body.account || '';
    const protocol = body.protocol || '';

    this.amqpConnection.publish('liquidator-exchange', 'liquidations-clear', {
      account,
      protocol,
    });

    return `Cleared liquidations list for ${
      Object.keys(body).length > 0 ? JSON.stringify(body) : 'all protocols'
    }`;
  }

  @ApiOperation({
    description: `Clears the liquidations blacklist or removes an account for a specific protocol from the liquidations blacklist.`,
  })
  @Post('custom-liquidation')
  customLiquidation(@Body() body: QueryCustomTxDto): string {
    if (
      !body ||
      !body.protocol ||
      !body.account ||
      !body.repayToken ||
      !body.seizeToken
    ) {
      return 'Please include "protocol", "account", "repayToken" and "seizeToken".';
    }
    this.logger.debug(
      `Creating liquidation tx with values: ${body.protocol} borrower: ${body.account}, repayToken: ${body.repayToken}, seizeToken: ${body.seizeToken}`,
    );

    const tx = {
      protocol: body.protocol,
      borrower: body.account,
      repayToken: body.repayToken,
      seizeToken: body.seizeToken,
    };
    this.amqpConnection.publish('liquidator-exchange', 'liquidate-many', [tx]);

    return `Sent liquidation transfer: ${JSON.stringify(tx)}`;
  }

  @ApiOperation({
    description: `Enables/Disables liquidation transactions at a protocol level.`,
  })
  @Post('protocol-status')
  protocolStatus(@Body() body: ProtocolEnableDto): string {
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
