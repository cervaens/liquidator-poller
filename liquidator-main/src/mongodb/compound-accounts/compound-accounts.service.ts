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

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'accounts-polled',
    queue: 'accounts',
  })
  public async accountsPolledHandler(
    msg: Record<string, Array<CompoundAccount>>,
  ) {
    const queries = [];
    for (const compoundAccount of msg.accounts) {
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
    if (res && res.result && res.result.nModified) {
      const candidateAccounts = msg.accounts.filter(
        (account) =>
          account.health >= parseFloat(process.env.CANDIDATE_MIN_HEALTH) &&
          account.health <= parseFloat(process.env.CANDIDATE_MAX_HEALTH),
      );
      if (candidateAccounts.length > 0) {
        this.amqpConnection.publish('liquidator-exchange', 'accounts-updated', {
          accounts: candidateAccounts,
        });
        this.logger.debug(
          candidateAccounts.length +
            ' candidate Compound accounts were updated',
        );
      }
    }
  }
}
