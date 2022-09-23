import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IBtoken } from '../ib-token/ib-token.schema';
import { IBAccount } from './classes/IBAccount';
import { IBaccounts, IBaccountsDocument } from './ib-accounts.schema';

@Injectable()
export class IbAccountsService {
  constructor(
    @InjectModel(IBaccounts.name)
    private ibAccountsModel: Model<IBaccountsDocument>,
  ) {}

  async accountEntersMarket(account: string, market: string) {
    return this.ibAccountsModel
      .findByIdAndUpdate(account, {
        address: account,
        $addToSet: {
          tokenList: market,
        },
      })
      .setOptions({ upsert: true })
      .then(async (res) => {
        if (!res || !res.tokens.find((doc) => doc.address === market)) {
          await this.ibAccountsModel.updateOne(
            { _id: account },
            {
              $push: {
                tokens: {
                  address: market,
                  borrow_balance_underlying: null,
                  supply_balance_underlying: null,
                },
              },
            },
          );
        }
      });
  }

  async accountExitsMarket(account: string, market: string): Promise<any> {
    return this.ibAccountsModel
      .findByIdAndUpdate(account, {
        $pull: {
          tokens: {
            address: market,
          },
          tokenList: market,
        },
      })
      .setOptions({ upsert: true });
  }

  async updateBalances(
    account: string,
    token: string,
    borrowBalance: number,
    supplyBalance: number,
  ) {
    return this.ibAccountsModel
      .findOneAndUpdate(
        { _id: account, 'tokens.address': token },
        {
          $set: {
            'tokens.$.borrow_balance_underlying': borrowBalance,
            'tokens.$.supply_balance_underlying': supplyBalance,
            lastUpdated: new Date().getTime(),
          },
        },
        { new: true },
      )
      .lean();
  }

  async findAllSortedLimited(): Promise<IBaccounts[]> {
    return this.ibAccountsModel
      .find()
      .sort({ lastUpdated: 1 })
      .limit(parseInt(process.env.IRONBANK_POLL_BALANCES_NR_ACCOUNTS) || 10)
      .exec();
  }

  async findAll(): Promise<IBaccounts[]> {
    return this.ibAccountsModel.find().exec();
  }

  async findAccount(account: string): Promise<IBaccounts> {
    return this.ibAccountsModel.findOne({ _id: account }).exec();
  }

  async calculateHealthAndStore(
    accounts: Array<Record<string, any>>,
    iTokens: Array<IBtoken>,
    prices: Record<string, any>,
  ) {
    const queries = [];
    for (const account of accounts) {
      const ibAccount = new IBAccount(account);
      ibAccount.updateAccount(iTokens, prices);
      queries.push({
        updateOne: {
          filter: { _id: ibAccount._id },
          update: ibAccount,
          upsert: true,
        },
      });
    }

    const res = await this.ibAccountsModel.bulkWrite(queries);
    return res;
  }
}
