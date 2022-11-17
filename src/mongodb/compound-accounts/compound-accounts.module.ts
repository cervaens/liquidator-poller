import { Module } from '@nestjs/common';
import { CompoundAccountsController } from './compound-accounts.controller';
import { CompoundAccountsService } from './compound-accounts.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CompoundAccounts,
  CompoundAccountsSchema,
} from './compound-accounts.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompoundAccounts.name, schema: CompoundAccountsSchema },
    ]),
  ],
  controllers: [CompoundAccountsController],
  providers: [CompoundAccountsService],
  exports: [CompoundAccountsService],
})
export class CompoundAccountsModule {}
