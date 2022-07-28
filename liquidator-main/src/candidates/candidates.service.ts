import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
// import { StandardAccount } from 'src/classes/StandardAccount';
import { CompoundAccount } from 'src/mongodb/compound-accounts/classes/CompoundAccount';

@Injectable()
export class CandidatesService {
  constructor(private readonly amqpConnection: AmqpConnection) {}
  private activeModuleCandidates: Record<string, CompoundAccount> = {};
  private readonly logger = new Logger(CandidatesService.name);
  private lastInitTs = 0;

  private cToken: Record<string, any> = {};
  private symbolPricesUSD: Record<string, number> = {};

  getCandidates(): Record<string, Record<string, any>> {
    return this.activeModuleCandidates;
  }

  getCandidatesForLiquidation(): Array<CompoundAccount> {
    return Object.values(this.activeModuleCandidates).filter(
      (candidate: CompoundAccount) =>
        candidate.profitUSD >
          parseInt(process.env.LIQUIDATION_MIN_USD_PROFIT) &&
        candidate.calculatedHealth < 1,
    );
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
  public async updatePricesHandler(msg: Record<string, number>) {
    this.symbolPricesUSD = msg;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-new',
    queue: 'candidates-new',
  })
  public async newCandidates(msg: Record<string, any>) {
    const candidateIds = [];
    if (msg.init && msg.initTs > this.lastInitTs) {
      this.activeModuleCandidates = {};
      this.lastInitTs = msg.initTs;
      this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
        action: 'deleteAll',
      });
    }
    if (!msg.init || msg.initTs === this.lastInitTs) {
      for (const account of msg.accounts) {
        const compoundAccount = new CompoundAccount(account);
        candidateIds.push(compoundAccount._id);
        compoundAccount.updateAccount(this.cToken, this.symbolPricesUSD);
        this.activeModuleCandidates[account.address] = compoundAccount;
      }
      this.logger.debug('Added ' + msg.accounts.length + ' new candidates');

      // Adding new candidates to global list
      this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
        action: 'add',
        ids: candidateIds,
      });
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-delete',
    queue: 'candidates-delete',
  })
  public async deleteCandidates(msg: Record<string, Array<string>>) {
    for (const id of msg.ids) {
      delete this.activeModuleCandidates[id];
    }
    this.logger.debug('Deleted ' + msg.ids.length + ' candidate(s)');

    // Adding new candidates to global list
    this.amqpConnection.publish('liquidator-exchange', 'candidates-list', {
      action: 'delete',
      ids: msg.ids,
    });
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'candidates-updated',
  })
  public async updateCandidates(
    msg: Record<string, Array<Record<string, any>>>,
  ) {
    for (const account of msg.accounts) {
      const compoundAccount = new CompoundAccount(account);
      compoundAccount.updateAccount(this.cToken, this.symbolPricesUSD);
      if (this.activeModuleCandidates[account.address]) {
        this.activeModuleCandidates[account.address] = compoundAccount;
      }
    }
    this.logger.debug('Updated ' + msg.accounts.length + ' candidates');
    // console.log(this.activeModuleCandidates);
  }
}
