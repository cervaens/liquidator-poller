import { Global, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { CompoundAccountsModule } from './mongodb/compound-accounts/compound-accounts.module';
import { CandidatesModule } from './candidates/candidates.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
      uri: 'amqp://localhost:5672',
      enableControllerDiscovery: true,
    }),
    AppModule,
    CompoundAccountsModule,
    CandidatesModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppController],
  exports: [RabbitMQModule],
})
export class AppModule {}
