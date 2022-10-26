import { Model } from 'mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  CompoundAccounts,
  CompoundAccountsDocument,
} from './compound-accounts.schema';
import { CompoundAccount } from './classes/CompoundAccount';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class CompoundAccountsService {
  private readonly logger = new Logger(CompoundAccountsService.name);
  private allActiveCandidates: Record<string, number> = {};
  private protocol = 'Compound';
  private sentInitLiqStatus = false;
  private enableCandidatesWithSameToken =
    process.env.CANDIDATE_ALLOW_SAME_TOKEN === 'true' ? true : false;

  constructor(
    @InjectModel(CompoundAccounts.name)
    private compoundAccountsModel: Model<CompoundAccountsDocument>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  getAllActiveCandidates(): Record<string, number> {
    return this.allActiveCandidates;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'set-same-token',
  })
  setSameTokenCandidates(msg: Record<string, boolean>) {
    this.enableCandidatesWithSameToken = msg.enabled;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'worker-joining',
  })
  public async dealWithNewWorker() {
    this.allActiveCandidates = {};
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidations-clear',
  })
  async clearLiquidationsList(msg: Record<string, string>) {
    const query = msg.account ? { _id: msg.account } : {};
    this.compoundAccountsModel
      .updateMany(query, {
        $set: {
          liquidationStatus: {},
        },
      })
      .exec();
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidations-called',
  })
  async updateAccountLiquidationStatus(msg: Record<string, any>) {
    if (!msg[this.protocol]) {
      return;
    }
    for (const accountAddress of Object.keys(msg[this.protocol])) {
      try {
        this.compoundAccountsModel
          .updateMany(
            { address: accountAddress },
            {
              $set: {
                liquidationStatus: msg[this.protocol][accountAddress],
              },
            },
          )
          .exec();
      } catch (err) {
        this.logger.debug(`Error updating liquidationStatus: ${err}`);
      }
    }
  }

  async sendLiquidationStatus() {
    const msg = {};
    msg[this.protocol] = {};
    const accountsOnLiquidation = await this.compoundAccountsModel
      .find({ 'liquidationStatus.status': 'ongoing', health: { $lt: 1 } })
      .lean();

    for (const account of accountsOnLiquidation) {
      msg[this.protocol][account.address] = account.liquidationStatus;
    }

    if (Object.keys(msg[this.protocol]).length > 0 || !this.sentInitLiqStatus) {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'liquidations-called',
        msg,
      );
      this.logger.debug('Sent liquidation status');
      this.sentInitLiqStatus = true;
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-list',
  })
  public async updateAllCandidatesList(msg: Record<string, any>) {
    if (
      msg.protocol !== this.protocol &&
      msg.action !== 'deleteBelowTimestamp'
    ) {
      return;
    }
    const curNumberCandidates = Object.keys(this.allActiveCandidates).length;
    if (msg.action === 'insert') {
      this.allActiveCandidates = { ...this.allActiveCandidates, ...msg.ids };
    } else if (msg.action === 'deleteBelowTimestamp') {
      for (const id of Object.keys(this.allActiveCandidates)) {
        if (this.allActiveCandidates[id] < msg.timestamp) {
          delete this.allActiveCandidates[id];
        }
      }
    }

    if (curNumberCandidates !== Object.keys(this.allActiveCandidates).length) {
      this.logger.debug(
        'Compound: Total nr. candidates: ' +
          Object.keys(this.allActiveCandidates).length,
      );
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'accounts-polled',
    queue: 'accounts',
  })
  public async accountsPolledHandler(
    msg: Record<string, Array<Record<string, any>>>,
  ) {
    const queries = [];
    const candidatesUpdated = [];
    const candidatesNew = [];
    if (msg && !msg.accounts) {
      this.logger.error(
        'Message for accounts-polled incorrect: ' + JSON.stringify(msg),
      );
      return;
    }
    for (const account of msg.accounts) {
      const compoundAccount = new CompoundAccount(account, true);
      compoundAccount.updateAccount(
        msg.cTokens,
        msg.cTokenPrices,
        this.enableCandidatesWithSameToken,
      );
      if (compoundAccount.isCandidate()) {
        !this.allActiveCandidates[compoundAccount._id] || msg.init
          ? candidatesNew.push(compoundAccount)
          : candidatesUpdated.push(compoundAccount);
      } else if (this.allActiveCandidates[compoundAccount._id]) {
        candidatesUpdated.push(compoundAccount);
      }

      queries.push({
        updateOne: {
          filter: { _id: compoundAccount._id },
          update: compoundAccount,
          upsert: true,
        },
      });
    }

    // BulkWrite returns the nr docs modified and its the fastest to execute
    const res = await this.compoundAccountsModel.bulkWrite(queries);
    if (
      candidatesNew.length > 0 ||
      (res && res.result && res.result.nModified)
    ) {
      if (candidatesNew.length > 0) {
        this.amqpConnection.publish('liquidator-exchange', 'candidates-new', {
          accounts: candidatesNew,
          init: msg.init,
          timestamp: msg.timestamp,
          protocol: this.protocol,
        });
        // this.logger.debug(
        //   candidatesNew.length + ' new Compound candidates were sent',
        // );
      }

      if (candidatesUpdated.length > 0) {
        this.amqpConnection.publish(
          'liquidator-exchange',
          'candidates-updated',
          {
            accounts: candidatesUpdated,
            protocol: this.protocol,
            timestamp: msg.timestamp,
          },
        );
      }
    }
  }
}
