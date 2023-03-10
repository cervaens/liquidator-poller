import { Model } from 'mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  CompoundAccounts,
  CompoundAccountsDocument,
} from './compound-accounts.schema';
import { CompoundAccount } from './classes/CompoundAccount';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { AppService } from 'src/app.service';

@Injectable()
export class CompoundAccountsService {
  private readonly logger = new Logger(CompoundAccountsService.name);
  public allActiveCandidates: Record<string, number> = {};
  private protocol = 'Compound';
  private sentInitLiqStatus = false;
  private enableCandidatesWithSameToken =
    process.env.CANDIDATE_ALLOW_SAME_TOKEN === 'true' ? true : false;
  private minProfit = parseFloat(process.env.LIQUIDATION_MIN_USD_PROFIT) || 50;

  constructor(
    @InjectModel(CompoundAccounts.name)
    private compoundAccountsModel: Model<CompoundAccountsDocument>,
    private readonly amqpConnection: AmqpConnection,
    private readonly appService: AppService,
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
    routingKey: 'set-min-profit',
  })
  setMinProfit(msg: Record<string, number>) {
    this.minProfit = msg.profit;
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
    if (!this.appService.amItheMaster()) {
      return;
    }
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
    if (!msg[this.protocol] || !this.appService.amItheMaster()) {
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

    // Sometimes a node goes down and candidates get lost
    // if (
    //   curNumberCandidates > Object.keys(this.allActiveCandidates).length &&
    //   this.appService.amItheMaster()
    // ) {
    //   this.logger.debug('Compound: Reloading candidates from DB');
    //   this.getCandidatesFromDB();
    // }
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
      if (compoundAccount.isCandidate(this.minProfit)) {
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
    const res = await this.compoundAccountsModel
      .bulkWrite(queries)
      .catch((err) => {
        this.logger.debug(
          `Error while updating compound accounts in mongo: ${err}`,
        );
      });
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
        // this.logger.debug(
        //   `Pushing ${candidatesUpdated.length} account for update`,
        // );
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

  getCandidatesFromDBqueryObj() {
    const time = new Date(new Date().getTime() - 300000);
    const expr = this.enableCandidatesWithSameToken
      ? {}
      : { $ne: ['$liqBorrow.tokenAddress', '$liqCollateral.tokenAddress'] };
    return {
      calculatedHealth: {
        $gte: parseFloat(process.env.CANDIDATE_MIN_HEALTH),
        $lte: parseFloat(process.env.CANDIDATE_MAX_HEALTH),
      },
      lastUpdated: { $gt: time },
      profitUSD: { $gte: this.minProfit },
      $expr: expr,
    };
  }

  async getAllCandidatesFromDB(accountAddress: string | any) {
    let query = this.getCandidatesFromDBqueryObj();
    if (accountAddress) {
      query = { ...query, _id: accountAddress } as typeof query;
    }
    return this.compoundAccountsModel.find(query).lean();
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'load-candidates-db',
  })
  async getCandidatesFromDB() {
    if (!this.appService.amItheMaster()) {
      return;
    }
    this.logger.debug('Compound: Reloading candidates from DB');
    let candidatesNew = [];
    return this.compoundAccountsModel
      .find(this.getCandidatesFromDBqueryObj())
      .lean()
      .then((candidates) => {
        for (const candidate of candidates) {
          if (this.allActiveCandidates[candidate._id]) {
            continue;
          }
          candidatesNew.push(candidate);
          if (candidatesNew.length === 10) {
            this.amqpConnection.publish(
              'liquidator-exchange',
              'candidates-new',
              {
                accounts: candidatesNew,
                protocol: this.protocol,
                // timestamp: msg.timestamp,
              },
            );
            candidatesNew = [];
          }
        }
        if (candidatesNew.length > 0) {
          this.amqpConnection.publish('liquidator-exchange', 'candidates-new', {
            accounts: candidatesNew,
            protocol: this.protocol,
            // timestamp: msg.timestamp,
          });
        }
      });
  }
}
