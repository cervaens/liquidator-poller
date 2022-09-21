import { Module } from '@nestjs/common';
import { CompoundAccountsModule } from './compound-accounts/compound-accounts.module';
import { CtokensModule } from './ctoken/ctoken.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [CompoundAccountsModule, CtokensModule, TransactionsModule],
  exports: [CtokensModule],
})
export class MongodbModule {}
