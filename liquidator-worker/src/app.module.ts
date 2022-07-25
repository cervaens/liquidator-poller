import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { MongooseModule } from '@nestjs/mongoose';
import { CompoundAccountsModule } from './compound-accounts/compound-accounts.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost/nest'),
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
  ],
  controllers: [AppController],
  providers: [AppService, AppController],
})
export class AppModule {}
