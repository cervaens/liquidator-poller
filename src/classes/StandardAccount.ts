export class StandardAccount {
  public address: string;
  public _id: string;
  public health: number;
  public tokens: Array<Record<string, any>>;
  public total_borrow_value_in_eth: number;
  public total_collateral_value_in_eth: number;

  constructor(json: Record<string, any>) {
    this.address = json.address;
    this._id = this.address;
  }

  // public updateAccount(tokenMap, prices) {
  //   return tokenMap + prices;
  // }
}
