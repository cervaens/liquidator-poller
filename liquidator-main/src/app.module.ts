import { Module, Global } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskSchedulerService } from './task-scheduler/task-scheduler.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { MongooseModule } from '@nestjs/mongoose';
import { CtokensModule } from './mongodb/ctoken/ctoken.module';
import { CompoundPollerModule } from './compound-poller/compound-poller.module';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [AppService, TaskSchedulerService],
  exports: [RabbitMQModule],
})
export class AppModule {}
