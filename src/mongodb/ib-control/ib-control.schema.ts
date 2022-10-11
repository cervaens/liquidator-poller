import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IBcontrolDocument = IBcontrol & Document;

@Schema()
export class IBcontrol {
  @Prop({ required: true })
  _id: string;

  @Prop()
  lastBlockNumberUnitrollerPoller: number;
}

export const IBcontrolSchema = SchemaFactory.createForClass(IBcontrol);
