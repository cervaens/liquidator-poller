import { Inject, Injectable, Logger } from '@nestjs/common';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import Web3 from 'web3';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import Web3Utils from 'web3-utils';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  public network: Record<string, any>;

  constructor(
    @Inject('WEB3PROV') private conn: Web3,
    private readonly provider: Web3ProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    const chainID = await this.provider.web3.eth.getChainId();
    switch (chainID) {
      case 1:
        this.network = {
          chain: 'mainnet',
          hardfork: 'london',
          chainId: chainID,
        };
        break;
      case 3:
        this.network = {
          chain: 'ropsten',
          hardfork: 'london',
          chainId: chainID,
        };
        break;
      case 4:
        this.network = {
          chain: 'rinkeby',
          hardfork: 'london',
          chainId: chainID,
        };
        break;
      case 31337:
        this.network = {
          chain: 'mainnet',
          hardfork: 'london',
          chainId: chainID,
        };
        // this.network = new Common({ chain: "rinkeby", hardfork: "london", chainId: chainID });
        break;
    }
  }

  /**
   * Estimates the gas necessary to send a given transaction
   *
   * @param {Object} tx an object describing the transaction. See `signAndSend`
   * @param {Number?} nonce the transaction's nonce, as an integer (base 10)
   * @param {Boolean?} anon whether gas should be estimated as if tx is from 0 address
   * @returns {Promise<Number>} estimated amount of gas that the tx will require
   *
   */
  estimateGas(tx, nonce = null, anon = false) {
    // tx = { ...tx };
    tx.from = process.env.ACCOUNT_ADDRESS_A;
    // if (nonce !== null) tx.nonce = Web3Utils.toHex(nonce);
    // delete tx["gasPrice"];
    // delete tx["gasLimit"];
    return this.provider.web3.eth.estimateGas(tx);
  }

  _txFor(to, method, gasLimit = undefined, gasPrice = undefined) {
    return {
      to,
      data: method.encodeABI(),
      gasLimit: gasLimit,
      gasPrice: gasPrice,
    };
  }

  /**
   * Convenience function that calls `provider.eth.getTransactionCount`
   *
   * @returns {Promise} the next unconfirmed (possibly pending) nonce (base 10)
   */
  async getLowestLiquidNonce() {
    return this.provider.web3.eth.getTransactionCount(
      process.env.ACCOUNT_ADDRESS_A,
    );
  }

  async getGasPrice() {
    return this.provider.web3.eth.getGasPrice();
  }

  signAndSend(tx, nonce) {
    tx = { ...tx };
    // this._gasPrices[nonce] = tx.gasPrice;

    tx.nonce = Web3Utils.toHex(nonce);
    tx.gasLimit = Web3Utils.toHex(tx.gasLimit.toFixed(0));
    tx.gasPrice = Web3Utils.toHex(parseInt(tx.gasPrice));
    return this._send(this._sign(tx));
  }

  /**
   * Signs a transaction with the wallet's private key
   * @private
   *
   * @param {Object} tx an object describing the transaction to sign
   * @returns {String} the serialized signed transaction
   *
   * @example
   * const tx = {
   *  nonce: '0x00',
   *  gasPrice: '0x09184e72a000',
   *  gasLimit: Big("3000000"),
   *  to: '0x0000...',
   *  value: '0x00',
   *  data: '0x7f74657374320...',
   * };
   * const signedTx = wallet._sign(tx);
   */
  _sign(tx) {
    // Set tx.from here since it must be signed by its sender.
    // i.e. this is the only valid value for tx.from
    tx.from = process.env.ACCOUNT_ADDRESS_A;
    // tx.value = 1;
    // tx.chainId = "0x4";
    // tx.gasLimit = "0x02625a00";
    tx.type = '0x02';
    tx.gas = 60000;

    tx.maxPriorityFeePerGas = '0x9502f900';
    tx.maxFeePerGas = '0xFF30622BB2'; // putting a very high fee as I got Transaction maxFeePerGas (2500000020) is too low for the next block, which has a baseFeePerGas of 7757457203
    // we need to implement here a block-level base fee fetch: https://ethereum.stackexchange.com/questions/123453/error-transactions-maxfeepergas-0-is-less-than-the-blocks-basefeepergas-52
    // Need to have the following LOCALLY as chain needs to go 31337
    tx.chainId = '0x' + this.network.chainId.toString(16);
    tx = FeeMarketEIP1559Transaction.fromTxData(tx, this.network);

    const signedTx = tx.sign(Buffer.from(process.env.ACCOUNT_SECRET_A, 'hex'));
    return '0x' + signedTx.serialize().toString('hex');
  }

  _send(signedTx) {
    return this.provider.web3.eth.sendSignedTransaction(signedTx);
  }
}
