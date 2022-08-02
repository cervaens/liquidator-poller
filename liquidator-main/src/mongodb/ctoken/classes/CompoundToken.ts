export class CompoundToken {
  private _json: Record<string, any>;
  public _id: string;
  public address: string;
  public symbol: string;
  public exchangeRate: number;
  public collateralFactor: number;
  public underlyingAddress: string;
  public underlyingSymbol: string;
  public decimals: number;

  constructor(json: Record<string, any>) {
    this._id = json.token_address;
    this.address = json.token_address;
    this.symbol = json.symbol;
    this.exchangeRate = json.exchange_rate.value;
    this.collateralFactor = json.collateral_factor.value;
    this.underlyingAddress = json.underlying_address;
    this.underlyingSymbol = json.underlying_symbol;
    this.decimals = this.getDecimals();
  }

  getDecimals() {
    const decimals = {
      cBAT: 18,
      cDAI: 18,
      cETH: 18,
      cREP: 18,
      cSAI: 18,
      cUSDC: 6,
      cUSDT: 6,
      cWBTC: 8,
      cWBTC2: 8,
      cZRX: 18,
      cUNI: 18,
      cCOMP: 18,
      cMKR: 18,
      CFEI: 18,
      cTUSD: 8,
      cLINK: 8,
      cAAVE: 8,
      cSUSHI: 8,
      cUSDP: 8,
      cYFI: 8,
    };
    return decimals[this.symbol] || 18;
  }
}
