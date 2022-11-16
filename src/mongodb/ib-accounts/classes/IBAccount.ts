import { StandardAccount } from '../../../classes/StandardAccount';

const uniswapNonSupportedList = [
  'MIM',
  'YFI',
  'ibGBP',
  'ibEUR',
  'EURS',
  'DPI',
  'ibAUD',
  'ibJPY',
  'ibKRW',
  'ibCHF',
];

const protocolSameTokenDiscard = ['WETH', 'USDC'];

export class IBAccount extends StandardAccount {
  private closeFactor = 0.5;
  private liquidationIncentive = 1.08;
  private protocol = 'IronBank';

  constructor(json: Record<string, any>) {
    super(json);
    this.tokens = json.tokens;
    this.health = json.health || 0;
    this.lastUpdated = new Date().getTime();

    this.total_borrow_value_in_eth = json.total_borrow_value_in_eth;
    this.total_collateral_value_in_eth = json.total_collateral_value_in_eth;
    this.profitUSD = json.profitUSD;
    this.liqCollateral = json.liqCollateral;
    this.liqBorrow = json.liqBorrow;
    this.totalDepositUSD = json.totalDepositUSD;
    this.totalBorrowUSD = json.totalBorrowUSD;
  }

  public isCandidate(minProfit: number) {
    return (
      this.getHealth() >= parseFloat(process.env.CANDIDATE_MIN_HEALTH) &&
      this.getHealth() <= parseFloat(process.env.CANDIDATE_MAX_HEALTH) &&
      this.profitUSD >= minProfit
    );
  }

  public getHealth(): number {
    return this.health;
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

  private isAbleToPickBest(
    sameTokenEnabled,
    collateralUnderlying,
    borrowUnderlying,
  ) {
    return (
      collateralUnderlying !== borrowUnderlying ||
      (sameTokenEnabled &&
        !protocolSameTokenDiscard.includes(collateralUnderlying))
    );
  }

  public updateAccount(
    iToken: Record<string, any>,
    chainlinkPricesUSD: Record<string, any>,
    sameTokenEnabled = false,
  ) {
    if (
      !iToken ||
      !chainlinkPricesUSD ||
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
      // There are suspended markets not outputted by the API
      // We are discarding this amounts for balance
      if (Object.keys(iToken).length > 0 && !iToken[token.address]) {
        continue;
      }

      // If the token is valid but no price for some reason we abort the whole calculation
      if (!chainlinkPricesUSD[token.address]) {
        console.log('No price for ' + token.address);
        return;
      }
      const underSymbol = iToken[token.address].underlyingSymbol;
      const decimals_underlying = iToken[token.address].decimals_underlying;
      const exchangeRate = iToken[token.address].exchangeRate;

      if (token.supply_balance_itoken > 0) {
        const colFactor = iToken[token.address].collateralFactor;
        const units_underlying = token.supply_balance_itoken * exchangeRate;
        const valueUSD =
          (units_underlying *
            (chainlinkPricesUSD[token.address] &&
              chainlinkPricesUSD[token.address].price)) /
          10 ** 8;
        totalDepositUSD += colFactor * valueUSD;

        if (!uniswapNonSupportedList.includes(underSymbol)) {
          const collateralObj = {
            valueUSD,
            symbol_underlying: underSymbol,
            tokenAddress: token.address,
            units_underlying,
            // decimals_underlying,
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
      }
      if (token.borrow_balance_underlying > 0) {
        const valueUSD =
          (token.borrow_balance_underlying *
            (chainlinkPricesUSD[token.address] &&
              chainlinkPricesUSD[token.address].price)) /
          10 ** decimals_underlying;

        totalBorrowUSD += valueUSD;

        if (!uniswapNonSupportedList.includes(underSymbol)) {
          const borrowObj = {
            valueUSD,
            symbol_underlying: underSymbol,
            tokenAddress: token.address,
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
    }

    if (top2Collateral.length === 0 || top2Borrow.length === 0) {
      return;
    }
    const ableToPickBest = this.isAbleToPickBest(
      sameTokenEnabled,
      top2Collateral[0].symbol_underlying,
      top2Borrow[0].symbol_underlying,
    );
    const repayIdx =
      !ableToPickBest &&
      top2Borrow[1] &&
      top2Borrow[1].valueUSD * this.closeFactor >
        (top2Collateral[1] && top2Collateral[1].valueUSD)
        ? 1
        : 0;

    const seizeIdx = Number(ableToPickBest ? 0 : !repayIdx);

    this.liqBorrow = top2Borrow[repayIdx] || { valueUSD: 0 };
    this.liqCollateral = top2Collateral[seizeIdx] || { valueUSD: 0 };

    this.health = totalDepositUSD / totalBorrowUSD || 0;
    this.totalDepositUSD = totalDepositUSD;
    this.totalBorrowUSD = totalBorrowUSD;
    this.profitUSD =
      Math.min(
        this.liqBorrow.valueUSD * this.closeFactor,
        this.liqCollateral.valueUSD,
      ) *
        (this.liquidationIncentive - 1.0 - 0.0009 - 0.003) || -1;
  }
}
