export class CompoundToken {
  private _json: Record<string, any>;

  constructor(json: Record<string, any>) {
    this._json = json;
  }

  public toMongoObj() {
    return {
      _id: this.address,
      address: this.address,
      symbol: this.symbol,
      exchangeRate: this.exchangeRate,
      collateralFactor: this.collateralFactor,
      underlyingAddress: this.underlyingAddress,
      underlyingSymbol: this.underlyingSymbol,
    };
  }

  get address() {
    return this._json.token_address;
  }

  get borrowRate() {
    return this._json.borrow_rate.value;
  }

  get cash() {
    return this._json.cash.value;
  }

  get collateralFactor() {
    return this._json.collateral_factor.value;
  }

  get exchangeRate() {
    return this._json.exchange_rate.value;
  }

  get interestRateModelAddress() {
    return this._json.interest_rate_model_address;
  }

  get name() {
    return this._json.name;
  }

  get numberOfBorrowers() {
    return this._json.number_of_borrowers;
  }

  get numberOfSuppliers() {
    return this._json.number_of_suppliers;
  }

  get reserves() {
    return this._json.reserves.value;
  }

  get supplyRate() {
    return this._json.supply_rate.value;
  }

  get symbol() {
    return this._json.symbol;
  }

  get totalBorrows() {
    return this._json.total_borrows.value;
  }

  get totalSupply() {
    return this._json.total_supply.value;
  }

  get underlyingAddress() {
    return this._json.underlying_address;
  }

  get underlyingName() {
    return this._json.underlying_name;
  }

  get underlyingPrice() {
    return this._json.underlying_price.value;
  }

  get underlyingSymbol() {
    return this._json.underlying_symbol;
  }
}
