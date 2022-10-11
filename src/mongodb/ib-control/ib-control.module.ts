import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IbControlController } from './ib-control.controller';
import { IBcontrol, IBcontrolSchema } from './ib-control.schema';
import { IbControlService } from './ib-control.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IBcontrol.name, schema: IBcontrolSchema },
    ]),
  ],
  controllers: [IbControlController],
  providers: [IbControlService],
  exports: [IbControlService],
})
export class IbControlModule {}
