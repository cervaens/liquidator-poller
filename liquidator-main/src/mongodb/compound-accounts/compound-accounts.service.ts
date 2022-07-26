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
  constructor(
    @InjectModel(CompoundAccounts.name)
    private compoundAccountsModel: Model<CompoundAccountsDocument>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  private isInit = true;

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'accounts-polled',
    queue: 'accounts',
  })
  public async accountsPolledHandler(
    msg: Record<string, Array<Record<string, any>>>,
  ) {
    const queries = [];
    const candidates = [];
    for (const account of msg.accounts) {
      const compoundAccount = new CompoundAccount(account);
      if (compoundAccount.isCandidate()) {
        candidates.push(account);
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
    if (this.isInit || (res && res.result && res.result.nModified)) {
      this.isInit = false;
      if (candidates.length > 0) {
        this.amqpConnection.publish(
          'liquidator-exchange',
          'candidates-updated',
          {
            accounts: candidates,
          },
        );
        this.logger.debug(
          candidates.length + ' candidate Compound accounts were updated',
        );
      }
    }
  }
}
