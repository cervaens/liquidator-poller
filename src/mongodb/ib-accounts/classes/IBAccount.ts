import { StandardAccount } from '../../../classes/StandardAccount';

export class IBAccount extends StandardAccount {
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
    this.tokens = json.tokens;
    this.health = json.health || 0;
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
    iToken: Record<string, any>,
    chainlinkPricesUSD: Record<string, any>,
  ) {
    if (
      Object.keys(iToken).length === 0 ||
      Object.keys(chainlinkPricesUSD).length === 0 ||
      this.tokens.length === 0
    ) {
      return;
    }
    let totalBorrowUSD = 0;
    let totalDepositUSD = 0;
    const top2Collateral = [];
    const top2Borrow = [];

    for (const token of this.tokens) {
      const underSymbol = iToken[token.address].underlyingSymbol;
      //TODO: changed underlyingAddress by address just till I build the prices part
      const underlyingAddress = iToken[token.address].address;
      const decimals_underlying = iToken[token.address].decimals_underlying;

      if (token.supply_balance_underlying > 0) {
        const colFactor = iToken[token.address].collateralFactor;
        const valueUSD =
          (token.supply_balance_underlying *
            ((chainlinkPricesUSD[underlyingAddress] &&
              chainlinkPricesUSD[underlyingAddress].price) ||
              0)) /
          (10 ** 6 * 10 ** decimals_underlying);
        totalDepositUSD += colFactor * valueUSD;

        const collateralObj = {
          valueUSD,
          symbol_underlying: underSymbol,
          iTokenAddress: token.address,
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
            ((chainlinkPricesUSD[underlyingAddress] &&
              chainlinkPricesUSD[underlyingAddress].price) ||
              0)) /
          (10 ** 6 * 10 ** decimals_underlying);

        totalBorrowUSD += valueUSD;

        const borrowObj = {
          valueUSD,
          symbol_underlying: underSymbol,
          iTokenAddress: token.address,
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

    if (top2Collateral.length === 0 || top2Borrow.length === 0) {
      return;
    }
    const ableToPickBest = !(
      top2Collateral[0].iTokenAddress === top2Borrow[0].iTokenAddress &&
      top2Collateral[0].iTokenAddress === iToken.cETH.address &&
      top2Borrow[0].units_underlying * this.closeFactor >=
        ((parseInt(iToken.cETH.walletBalance) || 0) *
          iToken.cETH.exchangeRate) /
          10 ** iToken.cETH.decimals
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

    this.health = totalDepositUSD / totalBorrowUSD;
    this.profitUSD =
      Math.min(
        this.liqBorrow.valueUSD * this.closeFactor,
        this.liqCollateral.valueUSD,
      ) *
        (this.liquidationIncentive - 1.0 - 0.0009 - 0.003) || -1;
  }
}
