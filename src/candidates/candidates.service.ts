import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
// import { StandardAccount } from 'src/classes/StandardAccount';
import { CompoundAccount } from 'src/mongodb/compound-accounts/classes/CompoundAccount';
import { IBAccount } from 'src/mongodb/ib-accounts/classes/IBAccount';

@Injectable()
export class CandidatesService {
  constructor(private readonly amqpConnection: AmqpConnection) {}
  private activeModuleCandidates: Record<
    string,
    Record<string, CompoundAccount | IBAccount>
  > = {};
  private readonly logger = new Logger(CandidatesService.name);
  private nextInit = 0;

  private protocolClass = {
    Compound: CompoundAccount,
    IronBank: IBAccount,
  };
  private tokens: Record<string, any> = {};
  private pricesUSD: Record<string, Record<string, Record<string, number>>> =
    {};

  getNrCandidates(): Record<string, number> {
    const result = { total: 0 };
    for (const protocol of Object.keys(this.activeModuleCandidates)) {
      result[protocol] = Object.keys(
        this.activeModuleCandidates[protocol],
      ).length;
      result.total += result[protocol];
    }
    return result;
  }

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
    for (const protocol of Object.keys(this.tokens)) {
      if (this.tokens[protocol][msg.token]) {
        this.tokens[protocol][msg.token].walletBalance = msg.balance;
      }
    }

    this.logger.debug('Got token balance: ' + JSON.stringify(msg));
  }

  getIsNextInit() {
    return this.nextInit;
  }

  getCandidatesForLiquidation(protocol: string): Array<any> {
    const candidatesToLiquidate = [];
    if (
      !this.activeModuleCandidates[protocol] ||
      Object.keys(this.activeModuleCandidates[protocol]).length === 0
    ) {
      return [];
    }

    for (const candidate of Object.values(
      this.activeModuleCandidates[protocol],
    )) {
      candidate.updateAccount(this.tokens[protocol], this.pricesUSD[protocol]);
      if (
        candidate.profitUSD >
          parseInt(process.env.LIQUIDATION_MIN_USD_PROFIT) &&
        candidate.getCalculatedHealth() < 1
      ) {
        candidatesToLiquidate.push(candidate);
      }
    }

    return candidatesToLiquidate.sort((a, b) => b.profitUSD - a.profitUSD);
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'tokens-polled',
  })
  public async updateTokensHandler(msg: Record<string, number>) {
    this.tokens[msg.protocol] = msg.tokens;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-polled',
  })
  public async updatePrices(msg: Record<string, any>) {
    this.pricesUSD[msg.protocol] = {
      ...this.pricesUSD[msg.protocol],
      ...msg.prices,
    };
    this.liquidateCandidates({ protocol: msg.protocol });
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
      // this.activeModuleCandidates = {};
      // Here we just clean compound's active candidates due to the way they are added
      this.activeModuleCandidates['Compound'] = {};
      this.nextInit = 0;
    }

    // Have to have this due to msgs from mq at init
    if (!this.activeModuleCandidates[msg.protocol]) {
      this.activeModuleCandidates[msg.protocol] = {};
    }

    for (const account of msg.accounts) {
      const protocolAccount = new this.protocolClass[msg.protocol](account);
      candidateIds[protocolAccount._id] = msg.timestamp;
      protocolAccount.updateAccount(
        this.tokens[msg.protocol],
        this.pricesUSD[msg.protocol],
      );
      this.activeModuleCandidates[msg.protocol][account.address] =
        protocolAccount;
    }
    // this.logger.debug('Added ' + msg.accounts.length + ' new candidates');

    // Adding new candidates to global list
    this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
      action: 'insert',
      ids: candidateIds,
      protocol: msg.protocol,
    });
    this.logger.debug(
      'Worker nr. candidates: ' + JSON.stringify(this.getNrCandidates()),
    );
    // }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-updated',
  })
  public async pricesUpdated(msg: Record<string, any>) {
    let liquidate = false;
    for (const priceObj of msg.prices) {
      if (!this.pricesUSD[msg.protocol]) {
        this.pricesUSD[msg.protocol] = {};
      }
      if (
        !this.pricesUSD[msg.protocol][priceObj.underlyingAddress] ||
        this.pricesUSD[msg.protocol][priceObj.underlyingAddress].blockNumber <
          priceObj.blockNumber
      ) {
        this.pricesUSD[msg.protocol][priceObj.underlyingAddress] = {
          blockNumber: priceObj.blockNumber,
          price: priceObj.price,
        };
        liquidate = true;
      }
    }
    if (liquidate) {
      this.liquidateCandidates({ protocol: msg.protocol });
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-updated',
  })
  public async updateCandidates(msg: Record<string, any>) {
    // const updateList = {};
    for (const account of msg.accounts) {
      // TODO: deal with account classes here
      const protocolAccount = new this.protocolClass[msg.protocol](account);
      protocolAccount.updateAccount(
        this.tokens[msg.protocol],
        this.pricesUSD[msg.protocol],
      );
      if (
        this.activeModuleCandidates[msg.protocol] &&
        this.activeModuleCandidates[msg.protocol][protocolAccount.address]
      ) {
        this.activeModuleCandidates[msg.protocol][protocolAccount.address] =
          protocolAccount;
        // updateList[protocolAccount._id] = msg.timestamp;
      }
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'trigger-liquidations',
  })
  liquidateCandidates(msg: Record<string, any>) {
    const candidates = this.getCandidatesForLiquidation(msg.protocol);

    let candidatesArray = [];
    this.logger.debug(
      `${msg.protocol}: Checking ${candidates.length} accounts for liquidation`,
    );
    for (let i = 0; i < candidates.length; i++) {
      const liqCand = {
        repayToken: candidates[i].liqBorrow.tokenAddress,
        amount: candidates[i].getLiqAmount(),
        seizeToken: candidates[i].liqCollateral.tokenAddress,
        borrower: candidates[i].address,
        profitUSD: candidates[i].profitUSD,
        protocol: msg.protocol,
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
