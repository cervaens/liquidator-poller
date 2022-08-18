import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionsDocument = Transactions & Document;

@Schema()
export class Transactions {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true })
  borrower: string;

  @Prop({ required: true })
  repayToken: string;

  @Prop({ required: true })
  seizeToken: string;

  @Prop({ required: true })
  sentDate: Date;

  @Prop({ required: true })
  createdDate: Date;

  @Prop({})
  receiptDate: Date;

  @Prop()
  gasUsed: number;

  @Prop()
  costInEth: number;

  @Prop()
  effectiveGasPrice: number;

  @Prop()
  blockNumber: number;
}

export const TransactionsSchema = SchemaFactory.createForClass(Transactions);
