import { Inject, Injectable, Logger } from '@nestjs/common';
import Web3 from 'web3';

import liquidatorAbi from './abis/FlashLiquidatorABI.json';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import Web3Utils from 'web3-utils';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';

@Injectable()
export class TxManagerService {
  private readonly logger = new Logger(TxManagerService.name);
  private liquidatorContract: Contract;
  private address: string =
    process.env.LIQUIDATOR_ADDRESS ||
    '0x0a17FabeA4633ce714F1Fa4a2dcA62C3bAc4758d';
  private network: Record<string, any>;
  constructor(
    @Inject('WEB3PROV') private conn: Web3,
    private readonly provider: Web3ProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.liquidatorContract = await this.initLiquidatorContract();

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

  _txFor(method, gasLimit = undefined, gasPrice = undefined) {
    return {
      to: this.address,
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

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidate',
    queue: 'liquidate',
  })
  async liquidate(msg: Record<string, any>) {
    const { repayCToken, amount, seizeCToken, borrower } = msg;
    const method = this.liquidatorContract.methods.flashSwap(
      repayCToken,
      parseInt(amount).toString(),
      seizeCToken,
      borrower,
    );

    const gasLimit = 3000000;
    const nonce = await this.getLowestLiquidNonce();
    // const gasPrice = await this.getGasPrice();
    const gasPrice = '3000000000';
    const sentTx = this.signAndSend(
      this._txFor(method, gasLimit, gasPrice),
      nonce,
    );

    sentTx.on('transactionHash', (hash) => {
      this.logger.debug(
        `<https://${this.network.chain}.etherscan.io/tx/${hash}>`,
      );
    });
    // After receiving receipt, log success and rebase
    sentTx.on('receipt', (receipt) => {
      // sentTx.removeAllListeners();
      this.logger.debug(` Successful at block ${receipt.blockNumber}!`);
      // this.rebase();
    });
    // After receiving an error, check if it occurred on or off chain
    sentTx.on('error', (err) => {
      // sentTx.removeAllListeners();
      // If it occurred on-chain, receipt will be defined.
      // Treat it the same as the successful receipt case.
      // if (receipt !== undefined) {
      //   this.logger.debug(label + 'Reverted');
      //   this.rebase();

      //   // Escape hatch
      //   this._revertCount++;
      //   if (this._revertCount >= this._revertTolerance) {
      //     this.logger.debug('TxQueue saw too many reverts. Shutting down.');
      //     process.exit();
      //   }
      //   return;
      // }
      const errStr = String(err);
      // Certain off-chain errors also indicate that we may need to rebase
      // our nonce. Check those:
      if (
        errStr.includes('replacement transaction underpriced') ||
        errStr.includes('already known')
      ) {
        this.logger.debug('Attempting rebase');
        // this.rebase();
      }
      // Certain errors are expected (and handled naturally by structure
      // of this queue) so we don't need to log them:
      if (!errStr.includes('Transaction was not mined within '))
        this.logger.debug('Off-chain ' + errStr);
    });

    // console.log(sentTx);
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

  async initLiquidatorContract() {
    // init new web3 with our infura key

    try {
      return new this.provider.web3.eth.Contract(
        liquidatorAbi as AbiItem[],
        this.address,
      );
    } catch (err) {
      this.logger.debug('Error starting liquidator contract');
    }
  }
}
