import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
// import { IbControlService } from '../ib-control/ib-control.service';
import { IBtoken } from '../ib-token/ib-token.schema';
import { IBAccount } from './classes/IBAccount';
import { IBaccounts, IBaccountsDocument } from './ib-accounts.schema';

@Injectable()
export class IbAccountsService {
  constructor(
    @InjectModel(IBaccounts.name)
    private ibAccountsModel: Model<IBaccountsDocument>, // private readonly ibControl: IbControlService,
  ) {}

  async accountEntersMarket(
    account: string,
    market: string,
    blockNumber: number,
  ) {
    return this.ibAccountsModel
      .findByIdAndUpdate(account, [
        {
          $set: {
            address: account,
            lastBlockNumber: blockNumber,
            tokens: {
              $cond: {
                if: {
                  $eq: [
                    {
                      $type: '$tokens',
                    },
                    'array',
                  ],
                },
                then: {
                  $cond: {
                    if: { $in: [market, '$tokens.address'] },
                    then: '$tokens',
                    else: {
                      $concatArrays: [
                        '$tokens',
                        [
                          {
                            address: market,
                            borrow_balance_underlying: null,
                            supply_balance_underlying: null,
                          },
                        ],
                      ],
                    },
                  },
                },
                else: [
                  {
                    address: market,
                    borrow_balance_underlying: null,
                    supply_balance_underlying: null,
                  },
                ],
              },
            },
          },
        },
      ])
      .setOptions({ upsert: true });
  }

  async accountExitsMarket(
    account: string,
    market: string,
    blockNumber: number,
  ): Promise<any> {
    return this.ibAccountsModel.findByIdAndUpdate(account, {
      $set: { lastBlockNumber: blockNumber },
      $pull: {
        tokens: {
          address: market,
        },
      },
    });
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

  async getLastAccountByBlockNumber(): Promise<IBaccounts> {
    return this.ibAccountsModel.findOne().sort({ lastBlockNumber: -1 }).lean();
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
