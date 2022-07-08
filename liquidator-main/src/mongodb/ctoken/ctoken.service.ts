import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Ctoken, CtokenDocument } from './ctoken.schema';
import { CtokenDto } from './dto/create-ctoken.dto';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class CtokenService {
  constructor(
    @InjectModel(Ctoken.name) private ctokenModel: Model<CtokenDocument>,
  ) {}

  async create(createCtokenDto: CtokenDto): Promise<Ctoken> {
    createCtokenDto['_id'] = createCtokenDto.address;
    const createdCtoken = await this.ctokenModel
      .findByIdAndUpdate(createCtokenDto['_id'], createCtokenDto)
      .setOptions({ upsert: true });
    return createdCtoken;
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
