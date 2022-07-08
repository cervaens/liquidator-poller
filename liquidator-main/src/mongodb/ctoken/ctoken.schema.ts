import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CtokenDocument = Ctoken & Document;

@Schema()
export class Ctoken {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  symbol: string;

  @Prop()
  collateralFactor: number;

  @Prop()
  exchangeRate: number;

  @Prop()
  underlyingSymbol: string;

  @Prop()
  underlyingAddress: string;

  @Prop()
  price: number;
}

export const CtokenSchema = SchemaFactory.createForClass(Ctoken);
