export class IronBankToken {
  private _json: Record<string, any>;
  public _id: string;
  public address: string;
  public symbol: string;
  public exchangeRate: number;
  public collateralFactor: number;
  public underlyingAddress: string;
  public underlyingSymbol: string;
  //   public decimals: number;
  public decimals_underlying: number;

  constructor(json: Record<string, any>) {
    this._id = json.token_address;
    this.address = json.token_address;
    this.symbol = json.symbol;
    this.exchangeRate = json.exchange_rate.value;
    this.collateralFactor = json.collateral_factor.value;
    this.underlyingAddress = json.underlying_address;
    this.underlyingSymbol = json.underlying_symbol;
    // this.decimals = this.getDecimals();
    this.decimals_underlying = json.underlying_decimals;
  }
}
