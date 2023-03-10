import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IBaccountsDocument = IBaccounts & Document;

class Token {
  address: string;
  borrow_balance_underlying: number;
  supply_balance_itoken: number;
}

class Liquidation {
  valueUSD: number;
  symbol_underlying: string;
  tokenAddress: string;
  units_underlying: number;
  collateral_factor: number;
}

class LiquidationStatus {
  timestamp: number;
  status: string;
  revertMsgWaitFor: string;
}

@Schema()
export class IBaccounts {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  tokens: Token[];

  @Prop()
  health: number;

  @Prop()
  lastBlockNumber: number;

  @Prop()
  lastUpdated: Date;

  @Prop()
  total_borrow_value_in_eth: number;

  @Prop()
  total_collateral_value_in_eth: number;

  @Prop()
  liqCollateral: Liquidation;

  @Prop()
  liqBorrow: Liquidation;

  @Prop()
  calculatedHealth: number;

  @Prop()
  profitUSD: number;

  @Prop()
  liquidationStatus: LiquidationStatus;
}

export const IBaccountsSchema = SchemaFactory.createForClass(IBaccounts);
