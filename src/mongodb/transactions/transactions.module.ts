import { Module } from '@nestjs/common';

import { TransactionsService } from './transactions.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Transactions, TransactionsSchema } from './transactions.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transactions.name, schema: TransactionsSchema },
    ]),
  ],
  controllers: [],
  providers: [TransactionsService],
})
export class TransactionsModule {}
