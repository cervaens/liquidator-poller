import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IronBankToken } from './classes/IronBankToken';
import { IBtoken, IBtokenDocument } from './ib-token.schema';

@Injectable()
export class IbTokenService {
  constructor(
    @InjectModel(IBtoken.name) private ctokenModel: Model<IBtokenDocument>,
  ) {}

  async createMany(IBtokenArray: Array<IronBankToken>): Promise<boolean> {
    for (const ibToken of IBtokenArray) {
      await this.ctokenModel
        .findByIdAndUpdate(ibToken._id, ibToken)
        .setOptions({ upsert: true });
    }

    return true;
  }
}
