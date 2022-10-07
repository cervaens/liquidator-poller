import { Module, Global } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { ScheduleModule } from '@nestjs/schedule';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import {
  // web3Con,
  Web3ProviderService,
  // web3Ws,
} from './web3-provider/web3-provider.service';
import { CandidatesModule } from './candidates/candidates.module';
import { TxManagerModule } from './tx-manager/tx-manager.module';
import { CompoundModule } from './compound/compound.module';
import { MongodbModule } from './mongodb/mongodb.module';
import { IronbankModule } from './ironbank/ironbank.module';
import { WalletController } from './wallet/wallet.controller';

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
    CompoundModule,
    HttpModule,
    MongodbModule,
    CandidatesModule,
    TxManagerModule,
    CompoundModule,
    MongodbModule,
    IronbankModule,
  ],
  controllers: [AppController, WalletController],
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
    MongodbModule,
    // 'WEB3WS',
    // 'WEB3PROV',
    AppService,
    Web3ProviderService,
  ],
})
export class AppModule {}
