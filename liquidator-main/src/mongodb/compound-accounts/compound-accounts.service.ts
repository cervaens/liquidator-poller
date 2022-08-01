import { Model } from 'mongoose';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  CompoundAccounts,
  CompoundAccountsDocument,
} from './compound-accounts.schema';
// import { CompoundAccountsDto } from './dto/create-ctoken.dto';
// import { NotFoundException } from '@nestjs/common';
import { CompoundAccount } from './classes/CompoundAccount';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class CompoundAccountsService {
  private readonly logger = new Logger(CompoundAccountsService.name);
  private allActiveCandidates: Record<string, number> = {};

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
    routingKey: 'worker-joining',
  })
  public async dealWithNewWorker() {
    this.allActiveCandidates = {};
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-list',
  })
  public async updateAllCandidatesList(msg: Record<string, any>) {
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
        'New list length: ' + Object.keys(this.allActiveCandidates).length,
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
    for (const account of msg.accounts) {
      const compoundAccount = new CompoundAccount(account);
      if (compoundAccount.isCandidate()) {
        !this.allActiveCandidates[compoundAccount._id] || msg.init
          ? candidatesNew.push(account)
          : candidatesUpdated.push(account);
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
            timestamp: msg.timestamp,
          },
        );
      }
    }
  }
}
