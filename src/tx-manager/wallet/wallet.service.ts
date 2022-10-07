import { Inject, Injectable, Logger } from '@nestjs/common';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import Web3Utils from 'web3-utils';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { AppService } from 'src/app.service';
import tokenBalanceABI from '../abis/tokenBalance.json';
import { AbiItem } from 'web3-utils';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private nonce: number;
  private nonceErrored = 0;
  private lastParsedNonce = 0;
  public network: Record<string, any>;
  private walletAddress = process.env.ACCOUNT_ADDRESS_B;
  private walletSecret = process.env.ACCOUNT_SECRET_B;
  private tokenContract = {};

  constructor(
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
    routingKey: 'i-am-master',
  })
  public async thereIsAMaster(msg: Record<string, boolean>) {
    if (msg.isNew && this.appService.amItheMaster()) {
      this.nonce = await this.getLowestLiquidNonce();
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'get-token-wallet-balance',
    queue: 'get-token-wallet-balance',
  })
  public async checkTokenBalance(msg: Record<string, string>) {
    const balance = await this.getTokenBalance(msg.tokenAddress);
    this.amqpConnection.publish('liquidator-exchange', 'token-wallet-balance', {
      token: msg.token,
      balance,
    });
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'execute-tx',
  })
  async executeTx(msg: Record<string, any>) {
    if (this.appService.amItheMaster()) {
      this.signAndSend(msg.tx, msg.profitUSD);
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
  estimateGas(tx) {
    // tx = { ...tx };
    tx.from = this.walletAddress;
    // if (nonce !== null) tx.nonce = Web3Utils.toHex(nonce);
    // delete tx["gasPrice"];
    // delete tx["gasLimit"];
    return this.provider.web3.eth.estimateGas(tx);
  }

  _txFor(to, method, gasLimit = undefined) {
    return {
      to,
      data: method.encodeABI(),
      gasLimit: gasLimit,
      // gasPrice: gasPrice,
    };
  }

  async getTokenBalance(tokenAddress: string) {
    if (!this.tokenContract[tokenAddress]) {
      this.tokenContract[tokenAddress] = new this.provider.web3.eth.Contract(
        tokenBalanceABI as AbiItem[],
        tokenAddress,
      );
    }
    return (
      this.tokenContract[tokenAddress] &&
      this.tokenContract[tokenAddress].methods
        .balanceOf(this.walletAddress)
        .call()
    );
  }
  /**
   * Convenience function that calls `provider.eth.getTransactionCount`
   *
   * @returns {Promise} the next unconfirmed (possibly pending) nonce (base 10)
   */
  async getLowestLiquidNonce() {
    return this.provider.web3.eth.getTransactionCount(this.walletAddress);
  }

  async rebase() {
    return this.getLowestLiquidNonce().then((res) => {
      this.nonce = res;
    });
  }

  async getGasPrice() {
    return this.provider.web3.eth.getGasPrice();
  }

  signAndSend(tx, profitUSD) {
    tx.nonce = Web3Utils.toHex(this.nonce);
    this.logger.debug('Setting nonce: ' + this.nonce);
    this.nonce += 1;
    tx.gasLimit = Web3Utils.toHex(tx.gasLimit);
    // tx.gasPrice = Web3Utils.toHex(parseInt(tx.gasPrice));

    const sentTx = this._send(this._sign(tx));
    const sentDate = new Date();

    sentTx.on('transactionHash', (hash) => {
      this.logger.debug(
        `<https://${this.network.chain}.etherscan.io/tx/${hash}>`,
      );
      this.amqpConnection.publish('liquidator-exchange', 'tx-created', {
        tx,
        sentDate,
        hash,
      });
    });
    // After receiving receipt, log success and rebase
    sentTx.on('receipt', (receipt) => {
      this.logger.debug(` Successful at block ${receipt.blockNumber}!`);
      this.amqpConnection.publish('liquidator-exchange', 'tx-processed', {
        receipt,
        profitUSD,
      });
    });
    // After receiving an error, check if it occurred on or off chain
    sentTx.on('error', (err) => {
      const errStr = String(err);
      // Certain off-chain errors also indicate that we may need to rebase
      // our nonce. Check those:
      const str = errStr.match(
        /Nonce too high. Expected nonce to be(.*)but got ([0-9]+)/,
      );
      if (str) {
        const parsedNonce = parseInt(str[2]);
        // Reducing nonce in case of error and replay tx
        if (parsedNonce > this.nonceErrored) {
          this.nonce = parsedNonce;
          this.lastParsedNonce = parsedNonce;
          this.nonceErrored = this.nonce;
        } else if (parsedNonce < this.lastParsedNonce) {
          this.nonce = parsedNonce;
          this.lastParsedNonce = parsedNonce;
        }
        this.logger.debug(
          'Off-chain ' + errStr + ' errored nonce: ' + this.nonceErrored,
        );
        this.signAndSend(tx, profitUSD);
      } else if (
        errStr.includes('replacement transaction underpriced') ||
        errStr.includes('already known')
      ) {
        this.logger.debug('Attempting rebase');
      }
      // Certain errors are expected (and handled naturally by structure
      // of this queue) so we don't need to log them:
      else if (!errStr.includes('Transaction was not mined within ')) {
        this.logger.debug('Off-chain ' + errStr);
      }
      this.amqpConnection.publish('liquidator-exchange', 'tx-processed', {
        tx,
        errStr,
        profitUSD,
      });
    });
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
   *  gasLimit: Big("3000000"),
   *  to: '0x0000...',
   *  data: '0x7f74657374320...',
   * };
   * const signedTx = wallet._sign(tx);
   */
  _sign(tx) {
    // Set tx.from here since it must be signed by its sender.
    // i.e. this is the only valid value for tx.from
    tx.from = this.walletAddress;
    tx.type = '0x02';

    tx.maxPriorityFeePerGas = '0x5D21DBA00'; // 12500000000 WEI, 12.5 GWEI for eth 1600 and gas 400000 gives around 8USDs
    // putting a very high fee as I got Transaction maxFeePerGas (2500000020) is too low for the next block, which has a baseFeePerGas of 7757457203
    // we need to implement here a block-level base fee fetch: https://ethereum.stackexchange.com/questions/123453/error-transactions-maxfeepergas-0-is-less-than-the-blocks-basefeepergas-52
    tx.maxFeePerGas = '0x6FC23AC00'; // 30000000000 or 30 GWEI for eth 1600 and gas 400000 gives around 19.2USDs
    // Need to have the following LOCALLY as chain needs to go 31337
    tx.chainId = '0x' + this.network.chainId.toString(16);
    tx = FeeMarketEIP1559Transaction.fromTxData(tx, this.network);

    const signedTx = tx.sign(Buffer.from(this.walletSecret, 'hex'));
    return '0x' + signedTx.serialize().toString('hex');
  }

  _send(signedTx) {
    return this.provider.web3.eth.sendSignedTransaction(
      signedTx,
      // (err, res) => {
      //   console.log(err + res);
      // },
    );
  }
}
