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
  private allActiveCandidates: Array<string> = [];
  constructor(
    @InjectModel(CompoundAccounts.name)
    private compoundAccountsModel: Model<CompoundAccountsDocument>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-list',
  })
  public async updateAllCandidatesList(msg: Record<string, any>) {
    if (msg.action === 'add') {
      this.allActiveCandidates = this.allActiveCandidates.concat(msg.ids);
      this.allActiveCandidates = [...new Set(this.allActiveCandidates)];
    } else if (msg.action === 'delete') {
      this.allActiveCandidates = this.allActiveCandidates.filter(
        (el) => !msg.ids.includes(el),
      );
    }
    this.logger.debug('New list length: ' + this.allActiveCandidates.length);
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
        this.allActiveCandidates.includes(compoundAccount._id)
          ? candidatesUpdated.push(account)
          : candidatesNew.push(account);
      }
      // compoundAccount.updateAccount(this.cToken, this.symbolPricesUSD);
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
        });
        this.logger.debug(
          candidatesNew.length + ' new Compound candidates were sent',
        );
      }

      if (candidatesUpdated.length > 0) {
        this.amqpConnection.publish(
          'liquidator-exchange',
          'candidates-updated',
          {
            accounts: candidatesUpdated,
          },
        );
      }
    }
  }
}
