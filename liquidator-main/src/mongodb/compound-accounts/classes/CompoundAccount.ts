import { StandardAccount } from '../../../classes/StandardAccount';

export class CompoundAccount extends StandardAccount {
  public address: string;
  public _id: string;
  public health: number;
  public tokens: Array<Record<string, any>>;
  public total_borrow_value_in_eth: number;
  public total_collateral_value_in_eth: number;
  public profitUSD: number;
  public calculatedHealth: number;
  public liqCollateral: Record<string, any> = { valueUSD: 0 };
  public liqBorrow: Record<string, any> = { valueUSD: 0 };
  private closeFactor = 0.5;
  private liquidationIncentive = 1.08;

  constructor(json: Record<string, any>) {
    super(json);
    this.tokens = this.tokensArrayToObj(json.tokens);
    this.total_borrow_value_in_eth = parseFloat(
      json.total_borrow_value_in_eth && json.total_borrow_value_in_eth.value,
    );
    this.total_collateral_value_in_eth = parseFloat(
      json.total_collateral_value_in_eth &&
        json.total_collateral_value_in_eth.value,
    );
  }

  private tokensArrayToObj(tokens: Array<Record<string, any>>) {
    const tokensArray: Array<Record<string, any>> = [];
    for (const token of tokens) {
      const tokenObj = {};
      for (const [key, value] of Object.entries(token)) {
        if (key.match(/^lifetime/)) {
          continue;
        }
        if (value && typeof value === 'object') {
          tokenObj[key] = parseFloat(value.value);
        } else {
          tokenObj[key] = value;
        }
      }
      tokensArray.push(tokenObj);
    }

    return tokensArray;
  }

  public isCandidate() {
    return (
      this.health >= parseFloat(process.env.CANDIDATE_MIN_HEALTH) &&
      this.health <= parseFloat(process.env.CANDIDATE_MAX_HEALTH)
    );
  }

  public getLiqAmount() {
    return this.liqBorrow.valueUSD / 2 <= this.liqCollateral.valueUSD
      ? this.liqBorrow.units * this.closeFactor * 10 ** this.liqBorrow.decimals
      : this.liqCollateral.units;
  }

  public updateAccount(cToken, symbolPricesUSD) {
    let totalBorrowUSD = 0;
    let totalDepositUSD = 0;

    for (const token of this.tokens) {
      const underSymbol = cToken[token.symbol].underlyingSymbol;
      const decimals = cToken[token.symbol].decimals;
      if (token.supply_balance_underlying > 0) {
        const colFactor = cToken[token.symbol].collateralFactor;
        const tokenValue =
          (token.supply_balance_underlying * symbolPricesUSD[underSymbol]) /
          10 ** 6;
        totalDepositUSD += colFactor * tokenValue;

        if (tokenValue > this.liqCollateral.valueUSD) {
          this.liqCollateral.valueUSD = tokenValue;
          this.liqCollateral.symbol = underSymbol;
          this.liqCollateral.cTokenAddress =
            token.address === '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5'
              ? '0x0000000000000000000000000000000000000000'
              : token.address;
          this.liqCollateral.units = token.supply_balance_underlying;
          this.liqCollateral.decimals = decimals;
        }
      }
      if (token.borrow_balance_underlying > 0) {
        const tokenValue =
          (token.borrow_balance_underlying * symbolPricesUSD[underSymbol]) /
          10 ** 6;

        totalBorrowUSD += tokenValue;
        if (tokenValue > this.liqBorrow.valueUSD) {
          this.liqBorrow.valueUSD = tokenValue;
          this.liqBorrow.symbol = underSymbol;
          this.liqBorrow.cTokenAddress =
            token.address === '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5'
              ? '0x0000000000000000000000000000000000000000'
              : token.address;
          this.liqBorrow.units = token.borrow_balance_underlying;
          this.liqBorrow.decimals = decimals;
        }
      }
    }
    this.calculatedHealth = totalDepositUSD / totalBorrowUSD;
    this.profitUSD =
      Math.min(
        this.liqBorrow.valueUSD * this.closeFactor,
        this.liqCollateral.valueUSD,
      ) *
      (this.liquidationIncentive - 1.0 - 0.0009 - 0.003);
  }
}
