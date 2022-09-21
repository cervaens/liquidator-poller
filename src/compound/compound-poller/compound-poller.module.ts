import { Module } from '@nestjs/common';
import { CompoundPricesWsService } from 'src/compound/compound-prices-ws/compound-prices-ws.service';
import { CompoundPollerController } from './compound-poller.controller';
import { CompoundPollerService } from './compound-poller.service';
import { CompoundPricesWsHelperService } from 'src/compound/compound-prices-ws/compound-prices-ws-helper/compound-prices-ws-helper.service';
import { CompoundPricesWsController } from 'src/compound/compound-prices-ws/compound-prices-ws.controller';
import { CtokenController } from 'src/mongodb/ctoken/ctoken.controller';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';

const CompoundPricesWsServicePrimary = {
  provide: 'CompoundPricesPrimaryInject',
  useFactory: (
    amqpConnection: AmqpConnection,
    ctoken: CtokenController,
    web3Provider: Web3ProviderService,
    helper: CompoundPricesWsHelperService,
  ) =>
    new CompoundPricesWsService(
      amqpConnection,
      ctoken,
      web3Provider.web3WsProviders[0],
      helper,
    ),
  inject: [
    AmqpConnection,
    CtokenController,
    Web3ProviderService,
    CompoundPricesWsHelperService,
  ],
};

const CompoundPricesWsServiceSecondary = {
  provide: 'CompoundPricesSecondaryInject',
  useFactory: (
    amqpConnection: AmqpConnection,
    ctoken: CtokenController,
    web3Provider: Web3ProviderService,
    helper: CompoundPricesWsHelperService,
  ) =>
    new CompoundPricesWsService(
      amqpConnection,
      ctoken,
      web3Provider.web3WsProviders[1] || web3Provider.web3WsProviders[0],
      helper,
    ),
  inject: [
    AmqpConnection,
    CtokenController,
    Web3ProviderService,
    CompoundPricesWsHelperService,
  ],
};
@Module({
  imports: [],
  providers: [
    CompoundPollerService,
    CompoundPricesWsServicePrimary,
    CompoundPricesWsServiceSecondary,
    CompoundPricesWsHelperService,
  ],
  controllers: [CompoundPollerController, CompoundPricesWsController],
  exports: [],
})
export class CompoundPollerModule {}
