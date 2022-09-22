import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IBaccounts, IBaccountsDocument } from './ib-accounts.schema';

@Injectable()
export class IbAccountsService {
  constructor(
    @InjectModel(IBaccounts.name)
    private ibAccountsModel: Model<IBaccountsDocument>,
  ) {}

  async accountEnterMarket(account: string, market: string): Promise<boolean> {
    await this.ibAccountsModel
      .findByIdAndUpdate(account, {
        $push: {
          tokens: {
            address: market,
            borrow_balance_underlying: null,
            supply_balance_underlying: null,
          },
        },
      })
      .setOptions({ upsert: true });

    return true;
  }

  async accountExitsMarket(account: string, market: string): Promise<boolean> {
    await this.ibAccountsModel
      .findByIdAndUpdate(account, {
        $pull: {
          tokens: {
            address: market,
          },
        },
      })
      .setOptions({ upsert: true });

    return true;
  }

  async findAll(): Promise<IBaccounts[]> {
    return this.ibAccountsModel.find().exec();
  }
}
