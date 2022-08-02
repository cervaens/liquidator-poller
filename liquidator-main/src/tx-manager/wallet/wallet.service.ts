import { Inject, Injectable, Logger } from '@nestjs/common';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import Web3 from 'web3';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import Web3Utils from 'web3-utils';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { AppService } from 'src/app.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private nonce: number;

  public network: Record<string, any>;

  constructor(
    @Inject('WEB3PROV') private conn: Web3,
    private readonly provider: Web3ProviderService,
    private readonly amqpConnection: AmqpConnection,
    @Inject(AppService) private appService: AppService,
  ) {}

  async onModuleInit(): Promise<void> {
    const chainID = await this.provider.web3.eth.getChainId();
    this.nonce = await this.getLowestLiquidNonce();
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

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'execute-tx',
  })
  async executeTx(tx: Record<string, any>) {
    if (!this.appService.amItheMaster) {
      return;
    }
    const sentTx = this.signAndSend(tx);

    sentTx.on('transactionHash', (hash) => {
      this.logger.debug(
        `<https://${this.network.chain}.etherscan.io/tx/${hash}>`,
      );
    });
    // After receiving receipt, log success and rebase
    sentTx.on('receipt', (receipt) => {
      this.logger.debug(` Successful at block ${receipt.blockNumber}!`);
    });
    // After receiving an error, check if it occurred on or off chain
    sentTx.on('error', (err) => {
      const errStr = String(err);
      // Certain off-chain errors also indicate that we may need to rebase
      // our nonce. Check those:
      if (
        errStr.includes('replacement transaction underpriced') ||
        errStr.includes('already known')
      ) {
        this.logger.debug('Attempting rebase');
      }
      // Certain errors are expected (and handled naturally by structure
      // of this queue) so we don't need to log them:
      if (!errStr.includes('Transaction was not mined within '))
        this.logger.debug('Off-chain ' + errStr);
    });
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

  signAndSend(tx) {
    tx = { ...tx };
    // this._gasPrices[nonce] = tx.gasPrice;

    tx.nonce = Web3Utils.toHex(this.nonce);
    this.logger.debug('Setting nonce: ' + this.nonce);
    this.nonce += 1;
    tx.gasLimit = Web3Utils.toHex(tx.gasLimit);
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
    this.logger.debug(`Sending with nonce: ${this.nonce - 1}`);
    return this.provider.web3.eth.sendSignedTransaction(
      signedTx,
      // (err, res) => {
      //   console.log(err + res);
      // },
    );
  }
}
