import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';
// import { StandardAccount } from 'src/classes/StandardAccount';
import { CompoundAccount } from 'src/mongodb/compound-accounts/classes/CompoundAccount';
import { IBAccount } from 'src/mongodb/ib-accounts/classes/IBAccount';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly appService: AppService,
  ) {}
  private activeModuleCandidates: Record<
    string,
    Record<string, CompoundAccount | IBAccount>
  > = {};
  private readonly logger = new Logger(CandidatesService.name);
  private nextInit = 0;
  private enableCandidatesWithSameToken =
    process.env.CANDIDATE_ALLOW_SAME_TOKEN === 'true' ? true : false;
  private minProfit = parseInt(process.env.LIQUIDATION_MIN_USD_PROFIT) || 50;

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
    routingKey: 'candidates-reset',
  })
  public resetCandidates() {
    // plus 3000 just to count with mq latency
    const timestamp = new Date().getTime() + 3000;
    this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
      action: 'deleteBelowTimestamp',
      timestamp,
    });
    this.activeModuleCandidates = {};
    this.logger.debug(
      'Worker nr. candidates: ' + JSON.stringify(this.getNrCandidates()),
    );
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

  deleteCandidate(protocol, accountAddress) {
    this.logger.debug(`Deleting candidate ${accountAddress} from ${protocol} `);
    delete this.activeModuleCandidates[protocol][accountAddress];
  }

  getIsNextInit() {
    return this.nextInit;
  }

  getCandidatesForLiquidation(
    protocol: string,
    prices: Array<any>,
  ): Array<any> {
    const candidatesToLiquidate = [];

    for (const protocolKey of Object.keys(this.activeModuleCandidates)) {
      if (protocol && protocolKey !== protocol) {
        continue;
      }
      this.logger.debug(
        `${protocolKey}: Checking ${
          Object.keys(this.activeModuleCandidates[protocolKey]).length
        } accounts for liquidation`,
      );
      for (const candidate of Object.values(
        this.activeModuleCandidates[protocolKey],
      )) {
        if (prices && prices.length > 0) {
          const candidatesTokens = candidate.tokens.map((cand) => cand.symbol);
          if (!prices.some((r) => candidatesTokens.includes(r))) {
            continue;
          }
        }
        candidate.updateAccount(
          this.tokens[protocolKey],
          this.pricesUSD[protocolKey],
          this.enableCandidatesWithSameToken,
        );
        if (
          candidate.profitUSD > this.minProfit &&
          candidate.getHealth() < 1 &&
          (this.enableCandidatesWithSameToken ||
            candidate.liqBorrow.tokenAddress !==
              candidate.liqCollateral.tokenAddress)
        ) {
          candidatesToLiquidate.push(candidate);
        }
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
    // Dont want to overwrite blockNumber
    if (!msg.init) {
      this.pricesUSD[msg.protocol] = {
        ...this.pricesUSD[msg.protocol],
        ...msg.prices,
      };
      this.checkCandidatesLiquidations({ protocol: msg.protocol });
    } else {
      this.pricesUSD[msg.protocol] = {
        ...msg.prices,
        ...this.pricesUSD[msg.protocol],
      };
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-new',
    queue: 'candidates-new',
    queueOptions: {
      messageTtl: 0,
    },
  })
  public async newCandidates(msg: Record<string, any>) {
    // Important for init when receiving candidate-new messages
    if (
      !msg.protocol ||
      !this.tokens[msg.protocol] ||
      !this.pricesUSD[msg.protocol]
    ) {
      return;
    }
    let checkLiquidations = false;
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
      // protocolAccount.updateAccount(
      //   this.tokens[msg.protocol],
      //   this.pricesUSD[msg.protocol],
      // );
      this.activeModuleCandidates[msg.protocol][account.address] =
        protocolAccount;

      if (protocolAccount.getHealth() < 1) {
        checkLiquidations = true;
      }
    }

    if (checkLiquidations) {
      this.checkCandidatesLiquidations({ protocol: msg.protocol });
    }
    // this.logger.debug('Added ' + msg.accounts.length + ' new candidates');

    // Adding new candidates to global list
    this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
      action: 'insert',
      ids: candidateIds,
      protocol: msg.protocol,
      nodeId: this.appService.nodeId,
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
    let checkLiquidations = false;
    for (const priceObj of msg.prices) {
      if (!this.pricesUSD[msg.protocol]) {
        this.pricesUSD[msg.protocol] = {};
      }
      if (
        !this.pricesUSD[msg.protocol][priceObj.underlyingAddress] ||
        (this.pricesUSD[msg.protocol][priceObj.underlyingAddress].blockNumber <
          priceObj.blockNumber &&
          this.pricesUSD[msg.protocol][priceObj.underlyingAddress].price !==
            priceObj.price)
      ) {
        this.pricesUSD[msg.protocol][priceObj.underlyingAddress] = {
          blockNumber: priceObj.blockNumber,
          price: priceObj.price,
        };
        checkLiquidations = true;
      }
    }
    if (checkLiquidations && !msg.noLiquidationCheck) {
      const updatedPricesSymbols = msg.prices.map(
        (priceObj) => priceObj.symbol,
      );
      this.checkCandidatesLiquidations({
        protocol: msg.protocol,
        fromMempool: msg.fromMempool,
        mempoolTx: msg.mempoolTx,
        gasPrices: msg.gasPrices,
        updatedPricesSymbols,
      });
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-updated',
  })
  public async updateCandidates(msg: Record<string, any>) {
    let checkLiquidations = false;

    for (const account of msg.accounts) {
      const protocolAccount = new this.protocolClass[msg.protocol](account);

      if (
        this.activeModuleCandidates[msg.protocol] &&
        this.activeModuleCandidates[msg.protocol][protocolAccount.address] &&
        protocolAccount.getHealth() !== 0 &&
        this.activeModuleCandidates[msg.protocol][
          protocolAccount.address
        ].getHealth() !== protocolAccount.getHealth()
      ) {
        if (protocolAccount.isCandidate(this.minProfit)) {
          this.activeModuleCandidates[msg.protocol][protocolAccount.address] =
            protocolAccount;
          if (protocolAccount.getHealth() < 1) {
            checkLiquidations = true;
          }
        } else {
          this.deleteCandidate(msg.protocol, protocolAccount.address);
        }
      } else if (
        this.activeModuleCandidates[msg.protocol] &&
        this.activeModuleCandidates[msg.protocol][protocolAccount.address]
      ) {
        this.activeModuleCandidates[msg.protocol][
          protocolAccount.address
        ].lastUpdated = protocolAccount.lastUpdated;
      }
    }

    if (checkLiquidations) {
      this.checkCandidatesLiquidations({ protocol: msg.protocol });
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'trigger-liquidations',
  })
  checkCandidatesLiquidations(msg: Record<string, any>) {
    let candidates = this.getCandidatesForLiquidation(
      msg.protocol,
      msg.updatedPricesSymbols,
    );

    if (msg.account) {
      candidates = candidates.filter(
        (candidate) => candidate.address === msg.account,
      );
    }

    const liqObj = { candidatesArray: [], ...msg };
    this.logger.debug(
      `${msg.protocol || 'All protocols'}: Trying to liquidate ${
        candidates.length
      } accounts`,
    );
    for (let i = 0; i < candidates.length; i++) {
      const liqCand = {
        repayToken: candidates[i].liqBorrow.tokenAddress,
        amount: candidates[i].getLiqAmount(),
        seizeToken: candidates[i].liqCollateral.tokenAddress,
        borrower: candidates[i].address,
        profitUSD: candidates[i].profitUSD,
        protocol: candidates[i].protocol,
        gasPrices: msg.gasPrices,
      };
      liqObj.candidatesArray.push(liqCand);
      if (liqObj.candidatesArray.length === 10) {
        this.amqpConnection.publish(
          'liquidator-exchange',
          'liquidate-many',
          liqObj,
        );
        liqObj.candidatesArray = [];
      }
    }
    if (liqObj.candidatesArray.length > 0) {
      this.amqpConnection.publish(
        'liquidator-exchange',
        'liquidate-many',
        liqObj,
      );
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-list',
  })
  /**
   * Deleting double candidates. When a node publishes its candidate
   * list, if another node whne receiving that list identifies one
   * common candidate, it deletes it.
   */
  public async deleteDoubleCandidates(msg: Record<string, any>) {
    if (
      msg.action === 'deleteBelowTimestamp' ||
      msg.nodeId === this.appService.nodeId
    ) {
      return;
    }
    for (const id of Object.keys(msg.ids)) {
      if (
        this.activeModuleCandidates[msg.protocol] &&
        this.activeModuleCandidates[msg.protocol][id]
      ) {
        this.logger.debug(
          `Deleting double candidate ${id} from protocol ${msg.protocol}`,
        );
        delete this.activeModuleCandidates[msg.protocol][id];
      }
    }
  }
}
