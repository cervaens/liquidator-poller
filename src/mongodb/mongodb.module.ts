import { Module } from '@nestjs/common';
import { CompoundAccountsModule } from './compound-accounts/compound-accounts.module';
import { CtokensModule } from './ctoken/ctoken.module';
import { TransactionsModule } from './transactions/transactions.module';
import { IbTokenModule } from './ib-token/ib-token.module';
import { IbAccountsModule } from './ib-accounts/ib-accounts.module';
import { IbControlModule } from './ib-control/ib-control.module';

@Module({
  imports: [
    CompoundAccountsModule,
    CtokensModule,
    TransactionsModule,
    IbTokenModule,
    IbAccountsModule,
    IbControlModule,
  ],
  exports: [CtokensModule, IbTokenModule, IbAccountsModule, IbControlModule],
})
export class MongodbModule {}
