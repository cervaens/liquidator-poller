export class CompoundAccount {
  public address: string;
  public _id: string;
  public health: number;
  public tokens: Array<Record<string, any>>;
  public total_borrow_value_in_eth: number;
  public total_collateral_value_in_eth: number;

  constructor(json: Record<string, any>) {
    this.address = json.address;
    this._id = this.address;
    this.health = parseFloat(json.health.value);
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
}
