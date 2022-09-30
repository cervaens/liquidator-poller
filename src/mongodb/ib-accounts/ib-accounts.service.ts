import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IronBankToken } from '../ib-token/classes/IronBankToken';
// import { IbControlService } from '../ib-control/ib-control.service';
// import { IBtoken } from '../ib-token/ib-token.schema';
import { IBAccount } from './classes/IBAccount';
import { IBaccounts, IBaccountsDocument } from './ib-accounts.schema';

@Injectable()
export class IbAccountsService {
  constructor(
    @InjectModel(IBaccounts.name)
    private ibAccountsModel: Model<IBaccountsDocument>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  private readonly logger = new Logger(IbAccountsService.name);
  private allActiveCandidates: Record<string, number> = {};
  private protocol = 'IronBank';

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
                            supply_balance_itoken: null,
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
                    supply_balance_itoken: null,
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
            'tokens.$.supply_balance_itoken': supplyBalance,
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

  async getCandidatesFromDB() {
    if (Object.keys(this.allActiveCandidates).length > 0) {
      return;
    }
    let candidatesNew = [];
    this.ibAccountsModel
      .find({
        health: {
          $gte: parseFloat(process.env.CANDIDATE_MIN_HEALTH),
          $lte: parseFloat(process.env.CANDIDATE_MAX_HEALTH),
        },
        profitUSD: { $gte: parseFloat(process.env.LIQUIDATION_MIN_USD_PROFIT) },
      })
      .lean()
      .then((candidates) => {
        for (const candidate of candidates) {
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

  async calculateHealthAndStore(
    accounts: Array<Record<string, any>>,
    iTokens: Record<string, IronBankToken>,
    prices: Record<string, any>,
  ) {
    const queries = [];
    const candidatesUpdated = [];
    const candidatesNew = [];

    for (const account of accounts) {
      const ibAccount = new IBAccount(account);
      ibAccount.updateAccount(iTokens, prices);

      if (ibAccount.isCandidate()) {
        !this.allActiveCandidates[ibAccount._id]
          ? candidatesNew.push(account)
          : candidatesUpdated.push(account);
      }

      queries.push({
        updateOne: {
          filter: { _id: ibAccount._id },
          update: ibAccount,
          upsert: true,
        },
      });
    }

    const res = await this.ibAccountsModel.bulkWrite(queries);

    if (candidatesNew.length > 0) {
      if (candidatesNew.length > 0) {
        this.amqpConnection.publish('liquidator-exchange', 'candidates-new', {
          accounts: candidatesNew,
          protocol: this.protocol,
          // timestamp: msg.timestamp,
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
            // timestamp: msg.timestamp,
          },
        );
      }
    }

    return res;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-list',
  })
  public async updateAllCandidatesList(msg: Record<string, any>) {
    if (msg.protocol !== this.protocol) {
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
        'Total nr. candidates: ' + Object.keys(this.allActiveCandidates).length,
      );
    }
  }
}
