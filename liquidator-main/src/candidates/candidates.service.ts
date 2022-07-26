import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
// import { StandardAccount } from 'src/classes/StandardAccount';
import { CompoundAccount } from 'src/mongodb/compound-accounts/classes/CompoundAccount';

@Injectable()
export class CandidatesService {
  constructor(private readonly amqpConnection: AmqpConnection) {}
  private activeCandidates: Record<string, Record<string, any>> = {};
  private readonly logger = new Logger(CandidatesService.name);

  private cToken: Record<string, any> = {};
  private symbolPricesUSD: Record<string, number> = {};

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
    routingKey: 'candidates-updated',
  })
  public async updateCandidates(
    msg: Record<string, Array<Record<string, any>>>,
  ) {
    for (const account of msg.accounts) {
      const compoundAccount = new CompoundAccount(account);
      compoundAccount.updateAccount(this.cToken, this.symbolPricesUSD);
      this.activeCandidates[account.address] = compoundAccount;
    }
    this.logger.debug('Received ' + msg.accounts.length + ' updates');
    // console.log(this.activeCandidates);
  }
}
