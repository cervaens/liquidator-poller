import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Ctoken, CtokenDocument } from './ctoken.schema';
import { CtokenDto } from './dto/create-ctoken.dto';
import { NotFoundException } from '@nestjs/common';
import { CompoundToken } from '../../compound-poller/classes/CompoundToken';

@Injectable()
export class CtokenService {
  constructor(
    @InjectModel(Ctoken.name) private ctokenModel: Model<CtokenDocument>,
  ) {}

  async create(createCtokenDto: CtokenDto): Promise<Ctoken> {
    const createdCtoken = await this.ctokenModel
      .findByIdAndUpdate(createCtokenDto['_id'], createCtokenDto)
      .setOptions({ upsert: true });
    return createdCtoken;
  }

  async createMany(CtokenArray: Array<CompoundToken>): Promise<boolean> {
    for (const cToken of CtokenArray) {
      const cTokenMongo = cToken.toMongoObj();
      await this.ctokenModel
        .findByIdAndUpdate(cTokenMongo._id, cTokenMongo)
        .setOptions({ upsert: true });
    }

    return true;
  }

  async findAll(): Promise<Ctoken[]> {
    return this.ctokenModel.find().exec();
  }

  async findOne(id: string) {
    const ctoken = await this.ctokenModel.findById(id);
    if (!ctoken) {
      throw new NotFoundException();
    }
    return ctoken;
  }

  async update(id: string, ctokenData: CtokenDto) {
    const ctoken = await this.ctokenModel
      .findByIdAndUpdate(id, ctokenData)
      .setOptions({ overwrite: true, new: true });
    if (!ctoken) {
      throw new NotFoundException();
    }
    return ctoken;
  }
}
