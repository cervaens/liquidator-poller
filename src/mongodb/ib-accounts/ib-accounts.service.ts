import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppService } from 'src/app.service';
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
    private readonly appService: AppService,
  ) {}

  private readonly logger = new Logger(IbAccountsService.name);
  public allActiveCandidates: Record<string, number> = {};
  private protocol = 'IronBank';
  private sentInitLiqStatus = false;
  private enableCandidatesWithSameToken =
    process.env.CANDIDATE_ALLOW_SAME_TOKEN === 'true' ? true : false;
  private minProfit = parseFloat(process.env.LIQUIDATION_MIN_USD_PROFIT) || 50;

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidations-clear',
  })
  async clearLiquidationsList(msg: Record<string, string>) {
    if (!this.appService.amItheMaster()) {
      return;
    }
    const query = msg.account ? { _id: msg.account } : {};
    this.ibAccountsModel
      .updateMany(query, {
        $set: {
          liquidationStatus: {},
        },
      })
      .exec();
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
    routingKey: 'liquidations-called',
  })
  async updateAccountLiquidationStatus(msg: Record<string, any>) {
    if (!msg[this.protocol] || !this.appService.amItheMaster()) {
      return;
    }
    for (const accountAddress of Object.keys(msg[this.protocol])) {
      this.ibAccountsModel
        .updateMany(
          { address: accountAddress },
          {
            $set: {
              liquidationStatus: msg[this.protocol][accountAddress],
            },
          },
        )
        .exec();
    }
  }

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

  async sendLiquidationStatus() {
    const msg = {};
    msg[this.protocol] = {};
    const accountsOnLiquidation = await this.ibAccountsModel
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
    return;
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

  async findAllSortedAndCandidates(): Promise<IBaccounts[]> {
    return this.ibAccountsModel
      .aggregate([
        { $match: this.getCandidatesFromDBqueryObj() },
        { $sort: { lastUpdated: 1 } },
        { $limit: parseInt(process.env.IRONBANK_POLL_BALANCES_NR_CANDIDATES) },
        {
          $unionWith: {
            coll: 'ibaccounts',
            pipeline: [
              { $sort: { lastUpdated: 1 } },
              {
                $limit: parseInt(
                  process.env.IRONBANK_POLL_BALANCES_NR_ACCOUNTS,
                ),
              },
            ],
          },
        },
        { $group: { _id: { address: '$address', tokens: '$tokens' } } },
        {
          $project: {
            _id: '$_id.address',
            address: '$_id.address',
            tokens: '$_id.tokens',
          },
        },
      ])
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

  getCandidatesFromDBqueryObj() {
    const time = new Date(new Date().getTime() - 300000);
    const expr = this.enableCandidatesWithSameToken
      ? {}
      : { $ne: ['$liqBorrow.tokenAddress', '$liqCollateral.tokenAddress'] };
    return {
      health: {
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
    return this.ibAccountsModel.find(query).lean();
  }

  async getCandidatesFromDB() {
    let candidatesNew = [];
    return this.ibAccountsModel
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

  async calculateHealthAndStore(
    accounts: Array<Record<string, any>>,
    iTokens: Record<string, IronBankToken>,
    prices: Record<string, any>,
  ) {
    const queries = [];
    const candidatesUpdated = [];
    const candidatesNew = [];
    // const triggerLiquidation = [];

    for (const account of accounts) {
      const ibAccount = new IBAccount(account);
      ibAccount.updateAccount(
        iTokens,
        prices,
        this.enableCandidatesWithSameToken,
      );

      if (ibAccount.isCandidate(this.minProfit)) {
        !this.allActiveCandidates[ibAccount._id]
          ? candidatesNew.push(ibAccount)
          : candidatesUpdated.push(ibAccount);

        // Trigger immediate liquidation check
        // if (ibAccount.health < 1) {
        //   triggerLiquidation.push(ibAccount);
        // }
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
      this.amqpConnection.publish('liquidator-exchange', 'candidates-updated', {
        accounts: candidatesUpdated,
        protocol: this.protocol,
        // timestamp: msg.timestamp,
      });
    }

    // if (triggerLiquidation.length > 0) {
    //   this.amqpConnection.publish(
    //     'liquidator-exchange',
    //     'trigger-liquidations',
    //     {
    //       protocol: this.protocol,
    //     },
    //   );
    //   this.logger.debug(
    //     `Triggering immediate liquidation check: ${JSON.stringify(
    //       triggerLiquidation,
    //     )}`,
    //   );
    // }
    return res;
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
        'IronBank: Total nr. candidates: ' +
          Object.keys(this.allActiveCandidates).length,
      );
    }

    // Sometimes a node goes down and candidates get lost
    if (
      curNumberCandidates > Object.keys(this.allActiveCandidates).length &&
      this.appService.amItheMaster()
    ) {
      this.logger.debug('IronBank: Reloading candidates from DB');
      this.getCandidatesFromDB();
    }
  }
}
