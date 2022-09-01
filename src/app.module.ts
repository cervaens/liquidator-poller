import { Module, Global } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { ScheduleModule } from '@nestjs/schedule';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { MongooseModule } from '@nestjs/mongoose';
import { CtokensModule } from './mongodb/ctoken/ctoken.module';
import { CompoundPollerModule } from './compound-poller/compound-poller.module';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
// import { Web3ProviderService } from './web3-provider/web3-provider.service';
// import { Web3ProviderModule } from './web3-provider/web3-provider.module';
import {
  // web3Con,
  Web3ProviderService,
  // web3Ws,
} from './web3-provider/web3-provider.service';
import { CompoundAccountsModule } from './mongodb/compound-accounts/compound-accounts.module';
import { TransactionsModule } from './mongodb/transactions/transactions.module';
import { CandidatesModule } from './candidates/candidates.module';
import { TxManagerModule } from './tx-manager/tx-manager.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ScheduleModule.forRoot(),
    MongooseModule.forRoot(
      process.env.MONGODB_URL +
        process.env.MONGODB_DBNAME +
        '?retryWrites=true&w=majority',
    ),
    RabbitMQModule.forRoot(RabbitMQModule, {
      exchanges: [
        {
          name: 'liquidator-exchange',
          type: 'topic',
        },
      ],
      uri: JSON.parse(process.env.RABBIT_MQ_URI_ARRAY) || [
        'amqp://localhost:5673',
        'amqp://localhost:5672',
      ],
      connectionInitOptions: { wait: false, timeout: 3000 },
      connectionManagerOptions: {
        reconnectTimeInSeconds: 0.0001,
      },
    }),
    AppModule,
    CtokensModule,
    CompoundPollerModule,
    HttpModule,
    CompoundAccountsModule,
    CandidatesModule,
    TxManagerModule,
    TransactionsModule,
    // Web3ProviderModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // {
    //   provide: 'WEB3PROV',
    //   useValue: web3Con,
    // },
    // {
    //   provide: 'WEB3WS',
    //   useValue: web3Ws,
    // },
    Web3ProviderService,
  ],
  exports: [
    RabbitMQModule,
    HttpModule,
    CtokensModule,
    CompoundPollerModule,
    // 'WEB3WS',
    // 'WEB3PROV',
    AppService,
    Web3ProviderService,
  ],
})
export class AppModule {}
