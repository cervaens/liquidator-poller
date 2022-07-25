import { Module, Global } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { ScheduleModule } from '@nestjs/schedule';
import { TaskSchedulerService } from './task-scheduler/task-scheduler.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { MongooseModule } from '@nestjs/mongoose';
import { CtokensModule } from './mongodb/ctoken/ctoken.module';
import { CompoundPollerModule } from './compound-poller/compound-poller.module';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
// import { Web3ProviderService } from './web3-provider/web3-provider.service';
// import { Web3ProviderModule } from './web3-provider/web3-provider.module';
import { web3Con, web3Ws } from './web3-provider/web3-provider.service';
import { CompoundAccountsModule } from './mongodb/compound-accounts/compound-accounts.module';

@Global()
@Module({
  imports: [
    // ScheduleModule.forRoot(),
    MongooseModule.forRoot('mongodb://localhost/nest'),
    RabbitMQModule.forRoot(RabbitMQModule, {
      exchanges: [
        {
          name: 'liquidator-exchange',
          type: 'topic',
        },
      ],
      uri: ['amqp://localhost:5672'],
      connectionInitOptions: { wait: false },
    }),
    AppModule,
    CtokensModule,
    CompoundPollerModule,
    HttpModule,
    ConfigModule.forRoot({ isGlobal: true }),
    CompoundAccountsModule,
    // Web3ProviderModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    TaskSchedulerService,
    // Web3ProviderService,
    {
      provide: 'WEB3PROV',
      useValue: web3Con,
    },
    {
      provide: 'WEB3WS',
      useValue: web3Ws,
    },
  ],
  exports: [
    RabbitMQModule,
    HttpModule,
    CtokensModule,
    CompoundPollerModule,
    'WEB3WS',
    'WEB3PROV',
  ],
})
export class AppModule {}
