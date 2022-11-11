export class StandardAccount {
  public address: string;
  public _id: string;
  public health: number;
  public tokens: Array<Record<string, any>>;
  public total_borrow_value_in_eth: number;
  public total_collateral_value_in_eth: number;
  public profitUSD: number;
  public calculatedHealth: number;
  public lastUpdated: number;
  public liqCollateral: Record<string, any> = { valueUSD: 0 };
  public liqBorrow: Record<string, any> = { valueUSD: 0 };
  public totalDepositUSD: number;
  public totalBorrowUSD: number;

  constructor(json: Record<string, any>) {
    this.address = json.address;
    this._id = this.address;
  }

  public hasSameLiqToken() {
    return (
      this.liqCollateral.symbol_underlying === this.liqBorrow.symbol_underlying
    );
  }

  public liqTokensValueAbove(abovePercent: number) {
    return (
      this.liqCollateral.valueUSD > abovePercent * this.totalDepositUSD &&
      this.liqBorrow.valueUSD > abovePercent * this.totalBorrowUSD
    );
  }

  public isStrongCandidate() {
    return (
      this.getHealth() >= 1 &&
      ((this.getHealth() <= 1.0005 &&
        this.hasSameLiqToken() &&
        this.liqTokensValueAbove(0.99)) ||
        (this.getHealth() <= 1.01 &&
          (!this.hasSameLiqToken() || !this.liqTokensValueAbove(0.99))))
    );
  }

  public getHealth(): number {
    return this.calculatedHealth || this.health;
  }

  // public updateAccount(tokenMap, prices) {
  //   return tokenMap + prices;
  // }
}
