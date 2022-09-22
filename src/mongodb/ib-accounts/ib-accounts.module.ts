import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IbAccountsController } from './ib-accounts.controller';
import { IBaccounts, IBaccountsSchema } from './ib-accounts.schema';
import { IbAccountsService } from './ib-accounts.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IBaccounts.name, schema: IBaccountsSchema },
    ]),
  ],
  controllers: [IbAccountsController],
  providers: [IbAccountsService],
  exports: [IbAccountsService],
})
export class IbAccountsModule {}
