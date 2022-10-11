import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IronBankToken } from './classes/IronBankToken';
import { IBtoken, IBtokenDocument } from './ib-token.schema';

@Injectable()
export class IbTokenService {
  constructor(
    @InjectModel(IBtoken.name) private itokenModel: Model<IBtokenDocument>,
  ) {}

  async createMany(IBtokenArray: Array<IronBankToken>): Promise<boolean> {
    for (const ibToken of IBtokenArray) {
      await this.itokenModel
        .findByIdAndUpdate(ibToken._id, ibToken)
        .setOptions({ upsert: true });
    }

    return true;
  }

  async findAll(): Promise<IBtoken[]> {
    return this.itokenModel.find().lean().exec();
  }
}
