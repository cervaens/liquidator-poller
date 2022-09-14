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
    return this.liqBorrow.valueUSD * this.closeFactor <=
      this.liqCollateral.valueUSD
      ? this.liqBorrow.units_underlying *
          this.closeFactor *
          10 ** this.liqBorrow.decimals_underlying
      : (this.liqBorrow.units_underlying *
          this.closeFactor *
          10 ** this.liqBorrow.decimals_underlying *
          this.liqCollateral.valueUSD) /
          this.liqBorrow.valueUSD;
  }

  public updateAccount(
    cToken: Record<string, any>,
    uAddressPricesUSD: Record<string, any>,
  ) {
    if (
      Object.keys(cToken).length === 0 ||
      Object.keys(uAddressPricesUSD).length === 0
    ) {
      return;
    }
    let totalBorrowUSD = 0;
    let totalDepositUSD = 0;
    const top2Collateral = [];
    const top2Borrow = [];

    for (const token of this.tokens) {
      const underSymbol = cToken[token.symbol].underlyingSymbol;
      const underlyingAddress = cToken[token.symbol].underlyingAddress;
      const decimals_underlying = cToken[token.symbol].decimals_underlying;

      if (token.supply_balance_underlying > 0) {
        const colFactor = cToken[token.symbol].collateralFactor;
        const valueUSD =
          (token.supply_balance_underlying *
            uAddressPricesUSD[underlyingAddress].price) /
          10 ** 6;
        totalDepositUSD += colFactor * valueUSD;

        const collateralObj = {
          valueUSD,
          symbol_underlying: underSymbol,
          cTokenAddress: token.address,
          units_underlying: token.supply_balance_underlying,
          decimals_underlying,
        };
        if (!top2Collateral[0] || valueUSD > top2Collateral[0].valueUSD) {
          top2Collateral.unshift(collateralObj);
        } else if (
          !top2Collateral[1] ||
          valueUSD > top2Collateral[1].valueUSD
        ) {
          top2Collateral[1] = collateralObj;
        }
      }
      if (token.borrow_balance_underlying > 0) {
        const valueUSD =
          (token.borrow_balance_underlying *
            uAddressPricesUSD[underlyingAddress].price) /
          10 ** 6;

        totalBorrowUSD += valueUSD;

        const borrowObj = {
          valueUSD,
          symbol_underlying: underSymbol,
          cTokenAddress: token.address,
          units_underlying: token.borrow_balance_underlying,
          decimals_underlying,
        };
        if (!top2Borrow[0] || valueUSD > top2Borrow[0].valueUSD) {
          top2Borrow.unshift(borrowObj);
        } else if (!top2Borrow[1] || valueUSD > top2Borrow[1].valueUSD) {
          top2Borrow[1] = borrowObj;
        }
      }
    }

    const ableToPickBest = !(
      top2Collateral[0].cTokenAddress === top2Borrow[0].cTokenAddress &&
      top2Collateral[0].cTokenAddress === cToken.cETH.address &&
      top2Borrow[0].units_underlying * this.closeFactor >=
        ((parseInt(cToken.cETH.walletBalance) || 0) *
          cToken.cETH.exchangeRate) /
          10 ** cToken.cETH.decimals
    );
    const repayIdx =
      !ableToPickBest &&
      top2Borrow[1] &&
      top2Borrow[1].valueUSD > (top2Collateral[1] && top2Collateral[1].valueUSD)
        ? 1
        : 0;

    const seizeIdx = Number(ableToPickBest ? 0 : !repayIdx);

    this.liqBorrow = top2Borrow[repayIdx] || {};
    this.liqCollateral = top2Collateral[seizeIdx] || {};

    this.calculatedHealth = totalDepositUSD / totalBorrowUSD;
    this.profitUSD =
      Math.min(
        this.liqBorrow.valueUSD * this.closeFactor,
        this.liqCollateral.valueUSD,
      ) *
        (this.liquidationIncentive - 1.0 - 0.0009 - 0.003) || -1;
  }
}
