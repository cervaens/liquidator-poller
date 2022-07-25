import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompoundAccountsDocument = CompoundAccounts & Document;

class Token {
  address: string;
  borrow_balance_underlying: number;
  safe_withdraw_amount_underlying: number;
  supply_balance_underlying: number;
}

@Schema()
export class CompoundAccounts {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  tokens: Token[];

  @Prop({ required: true })
  symbol: string;

  @Prop({ required: true })
  health: number;

  @Prop()
  total_borrow_value_in_eth: number;

  @Prop()
  total_collateral_value_in_eth: number;
}

export const CompoundAccountsSchema =
  SchemaFactory.createForClass(CompoundAccounts);
