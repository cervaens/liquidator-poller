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
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class CompoundAccountsService {
  private readonly logger = new Logger(CompoundAccountsService.name);
  constructor(
    @InjectModel(CompoundAccounts.name)
    private compoundAccountsModel: Model<CompoundAccountsDocument>,
  ) {}

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'accounts-polled',
    queue: 'accounts',
  })
  public async accountsPolledHandler(
    msg: Record<string, Array<CompoundAccount>>,
  ) {
    this.logger.debug('Got accounts');
    for (const compoundAccount of msg.accounts) {
      await this.compoundAccountsModel
        .findByIdAndUpdate(compoundAccount._id, compoundAccount)
        .setOptions({ upsert: true });
    }
    this.logger.debug('Stored accounts');
  }
}
