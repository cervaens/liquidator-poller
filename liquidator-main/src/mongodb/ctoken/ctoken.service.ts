import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Ctoken, CtokenDocument } from './ctoken.schema';
import { CtokenDto } from './dto/create-ctoken.dto';
import { NotFoundException } from '@nestjs/common';
import { CompoundToken } from './classes/CompoundToken';

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

  async findWithParams(
    filter: Record<string, string>,
    output: Record<string, number>,
  ): Promise<Ctoken[]> {
    return this.ctokenModel.find(filter, output).exec();
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

  async updateMany(
    filter: Record<string, unknown>,
    setStat: Record<string, unknown>,
  ) {
    return this.ctokenModel.updateMany(filter, setStat);
  }

  async updateCtokenPriceFromAddressOrSymbol(
    address: string,
    underlyingSymbol: string,
    price: number,
    extraUpdate: Record<string, any>,
  ) {
    let query: Record<string, string>;
    if (address) {
      query = { address };
    }
    if (underlyingSymbol) {
      query = { underlyingSymbol };
    }
    const updateSetExpression: Record<string, any> = {
      underlyingPrice: price,
    };
    if (extraUpdate) {
      Object.assign(updateSetExpression, extraUpdate);
    }
    return this.updateMany(query, { $set: updateSetExpression });
  }
}
