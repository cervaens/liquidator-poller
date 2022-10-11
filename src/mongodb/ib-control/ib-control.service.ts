import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IBcontrol, IBcontrolDocument } from './ib-control.schema';

@Injectable()
export class IbControlService {
  constructor(
    @InjectModel(IBcontrol.name)
    private ibControlModel: Model<IBcontrolDocument>,
  ) {}

  private readonly logger = new Logger(IbControlService.name);

  async updateItem(item: string, value: any): Promise<IBcontrol> {
    const update = {};
    update[item] = value;
    this.logger.debug(`Updating ${item} for Unitroller Poller to ${value}`);

    return this.ibControlModel
      .findByIdAndUpdate('control', {
        $set: update,
      })
      .setOptions({ upsert: true });
  }

  async findAll(): Promise<IBcontrol[]> {
    return this.ibControlModel.find().exec();
  }

  async getControlObj(): Promise<IBcontrol> {
    return this.ibControlModel.findOne({ _id: 'control' }).exec();
  }
}
