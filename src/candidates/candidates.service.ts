import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
// import { StandardAccount } from 'src/classes/StandardAccount';
import { CompoundAccount } from 'src/mongodb/compound-accounts/classes/CompoundAccount';

@Injectable()
export class CandidatesService {
  constructor(private readonly amqpConnection: AmqpConnection) {}
  private activeModuleCandidates: Record<string, CompoundAccount> = {};
  private readonly logger = new Logger(CandidatesService.name);
  private nextInit = 0;

  private cToken: Record<string, any> = {};
  private uAddressPricesUSD: Record<string, Record<string, number>> = {};

  getCandidates(): Record<string, Record<string, any>> {
    return this.activeModuleCandidates;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'worker-joining',
  })
  public async dealWithNewWorker(msg: Record<string, number>) {
    this.nextInit = msg.timestamp;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'token-wallet-balance',
  })
  public async updateTokenBalances(msg: Record<string, number>) {
    this.cToken[msg.token].walletBalance = msg.balance;
    this.logger.debug('Got token balance: ' + JSON.stringify(msg));
  }

  getIsNextInit() {
    return this.nextInit;
  }

  getCandidatesForLiquidation(): Array<CompoundAccount> {
    const candidatesToLiquidate = [];
    for (const candidate of Object.values(this.activeModuleCandidates)) {
      candidate.updateAccount(this.cToken, this.uAddressPricesUSD);
      if (
        candidate.profitUSD >
          parseInt(process.env.LIQUIDATION_MIN_USD_PROFIT) &&
        candidate.calculatedHealth < 1
      ) {
        candidatesToLiquidate.push(candidate);
      }
    }

    return candidatesToLiquidate.sort((a, b) => b.profitUSD - a.profitUSD);
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'ctokens-polled',
  })
  public async updateCtokensHandler(msg: Record<string, number>) {
    this.cToken = msg;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-polled',
  })
  public async updatePricesHandler(msg: Record<string, Record<string, any>>) {
    this.uAddressPricesUSD = msg;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-new',
    queue: 'candidates-new',
  })
  public async newCandidates(msg: Record<string, any>) {
    const candidateIds = {};
    // We need to compare timestamp as worker might annouce joining during
    // candidate distribution
    if (this.nextInit && msg.timestamp > this.nextInit) {
      this.activeModuleCandidates = {};
      this.nextInit = 0;
    }

    for (const account of msg.accounts) {
      const compoundAccount = new CompoundAccount(account);
      candidateIds[compoundAccount._id] = msg.timestamp;
      compoundAccount.updateAccount(this.cToken, this.uAddressPricesUSD);
      this.activeModuleCandidates[account.address] = compoundAccount;
    }
    // this.logger.debug('Added ' + msg.accounts.length + ' new candidates');

    // Adding new candidates to global list
    this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
      action: 'insert',
      ids: candidateIds,
    });
    this.logger.debug(
      'Worker nr. candidates: ' + Object.keys(this.getCandidates()).length,
    );
    // }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-updated',
  })
  public async pricesUpdated(msg: Array<Record<string, any>>) {
    let liquidate = false;
    for (const priceObj of msg) {
      if (
        !this.uAddressPricesUSD[priceObj.underlyingAddress] ||
        this.uAddressPricesUSD[priceObj.underlyingAddress].blockNumber <
          priceObj.blockNumber
      ) {
        this.uAddressPricesUSD[priceObj.underlyingAddress] = {
          blockNumber: priceObj.blockNumber,
          price: priceObj.price,
        };
        liquidate = true;
      }
    }
    if (liquidate) {
      this.liquidateCandidates();
    }
  }

  // @RabbitSubscribe({
  //   exchange: 'liquidator-exchange',
  //   routingKey: 'candidates-delete',
  //   queue: 'candidates-delete',
  // })
  // public async deleteCandidates(msg: Record<string, Array<string>>) {
  //   for (const id of msg.ids) {
  //     delete this.activeModuleCandidates[id];
  //   }
  //   this.logger.debug('Deleted ' + msg.ids.length + ' candidate(s)');

  //   // Adding new candidates to global list
  //   this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
  //     action: 'delete',
  //     ids: msg.ids,
  //   });
  // }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-updated',
  })
  public async updateCandidates(
    msg: Record<string, Array<Record<string, any>>>,
  ) {
    // const updateList = {};
    for (const account of msg.accounts) {
      const compoundAccount = new CompoundAccount(account);
      compoundAccount.updateAccount(this.cToken, this.uAddressPricesUSD);
      if (this.activeModuleCandidates[compoundAccount.address]) {
        this.activeModuleCandidates[compoundAccount.address] = compoundAccount;
        // updateList[compoundAccount._id] = msg.timestamp;
      }
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'trigger-liquidations',
  })
  liquidateCandidates() {
    const candidates = this.getCandidatesForLiquidation();

    let candidatesArray = [];
    this.logger.debug(`Checking ${candidates.length} accounts for liquidation`);
    for (let i = 0; i < candidates.length; i++) {
      const liqCand = {
        repayCToken: candidates[i].liqBorrow.cTokenAddress,
        amount: candidates[i].getLiqAmount(),
        seizeCToken: candidates[i].liqCollateral.cTokenAddress,
        borrower: candidates[i].address,
        profitUSD: candidates[i].profitUSD,
      };
      candidatesArray.push(liqCand);
      if (candidatesArray.length === 10) {
        this.amqpConnection.publish(
          'liquidator-exchange',
          'liquidate-many',
          candidatesArray,
        );
        candidatesArray = [];
      }
    }
    if (candidatesArray.length > 0) {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'liquidate-many',
        candidatesArray,
      );
    }
  }
}
