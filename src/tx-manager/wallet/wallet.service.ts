import { Inject, Injectable, Logger } from '@nestjs/common';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import Web3Utils from 'web3-utils';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { AppService } from 'src/app.service';
import tokenBalanceABI from '../abis/tokenBalance.json';
import { AbiItem } from 'web3-utils';
import { FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private nonce: number;
  private nonceErrored = 0;
  private lastParsedNonce = 0;
  public network: Record<string, any>;
  private walletAddress = process.env.ACCOUNT_ADDRESS_A;
  private walletSecret = process.env.ACCOUNT_SECRET_A;
  private paymentToMinerPct: number =
    parseInt(process.env.BUNDLE_MINER_PAYMENT_PCT) || 10;
  private tokenContract = {};
  private gasPriceGwei = 30;
  private maxPriorityFeePerGasGwei = 20;
  private maxFeePerGasAddToPrice = 15;
  private ethPrice = {
    blockNumber: 0,
    price: 1200000000,
  };
  private paymentToMinerInPriority =
    process.env.BUNDLE_PAY_IN_PRIORITY === 'true' ? true : false;

  constructor(
    private readonly provider: Web3ProviderService,
    private readonly amqpConnection: AmqpConnection,
    @Inject(AppService) private appService: AppService,
  ) {}

  async onModuleInit(): Promise<void> {
    const chainID = await this.provider.web3.eth.getChainId();
    this.rebase();
    this.getGasPrice();
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
      case 5:
        this.network = {
          chain: 'goerli',
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
    routingKey: 'set-miner-percent',
  })
  setMinProfit(msg: Record<string, number>) {
    this.paymentToMinerPct = msg.percent;
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
      const estimatedFees =
        msg.estimatedGas * (this.gasPriceGwei + this.maxFeePerGasAddToPrice);

      if (msg.profitUSD < 100 && estimatedFees > 45000000) {
        this.logger.debug(
          `Cancelling TX creation: Profit too short and risky. Estimated fees ${estimatedFees}. Gas Price: ${this.gasPriceGwei}`,
        );
      } else if (msg.fromMempool) {
        this.logger.debug(
          ` * CREATING Bundle * in ${msg.protocol} for account ${msg.accountAddress} `,
        );
        this.createBundle(
          msg.tx,
          msg.profitUSD,
          msg.protocol,
          msg.accountAddress,
          msg.mempoolTx,
          msg.estimatedGas,
        );
      } else {
        this.logger.debug(
          ` * CREATING TX * in ${msg.protocol} for account ${msg.accountAddress} `,
        );
        this.signAndSend(
          msg.tx,
          msg.profitUSD,
          msg.protocol,
          msg.accountAddress,
          msg.gasPrices,
        );
      }
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
        .catch((err) => {
          this.logger.error(
            `Couldn't get token balance for token ${tokenAddress}: ${err}`,
          );
        })
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
    return this.provider.web3.eth.getGasPrice().then((res) => {
      if (res) {
        this.gasPriceGwei = parseInt(res) * 10 ** -9;
        this.logger.debug(`Gas Price now at ${this.gasPriceGwei}`);
      }
    });
  }

  async createBundle(
    tx,
    profitUSD,
    protocol,
    accountAddress,
    mempoolTx,
    estimateGas,
  ) {
    const paymentToMiner =
      (profitUSD / (this.ethPrice.price * 10 ** -6)) *
      (this.paymentToMinerPct / 100);
    this.logger.debug(`Paying to miner ${paymentToMiner} ETH`);

    const pendingBlock = await this.provider.ethers.getBlock(
      mempoolTx.pendingBlockNumber,
    );

    tx.nonce = Web3Utils.toHex(this.nonce);
    this.logger.debug('Setting nonce: ' + this.nonce);
    this.nonce += 1;
    tx.gasLimit = Web3Utils.toHex(tx.gasLimit);

    tx.from = this.walletAddress;
    tx.type = '0x02';
    // Need to have the following LOCALLY as chain needs to go 31337
    tx.chainId = '0x' + this.network.chainId.toString(16);

    const mempoolTransaction = await this.provider.ethers.getTransaction(
      mempoolTx.hash,
    );

    if (this.paymentToMinerInPriority) {
      tx.maxPriorityFeePerGas = Math.round(
        (paymentToMiner * 10 ** 18) / estimateGas,
      );
      tx.maxFeePerGas = (
        (mempoolTransaction.maxFeePerGas && mempoolTransaction.maxFeePerGas) ||
        (pendingBlock.baseFeePerGas && pendingBlock.baseFeePerGas)
      ).add(tx.maxPriorityFeePerGas)._hex;
      tx.maxPriorityFeePerGas = '0x' + tx.maxPriorityFeePerGas.toString(16);
    } else {
      tx.value = '0x' + Math.floor(paymentToMiner * 10 ** 18).toString(16);
      tx.maxFeePerGas =
        (mempoolTransaction.maxFeePerGas &&
          mempoolTransaction.maxFeePerGas._hex) ||
        (pendingBlock.baseFeePerGas && pendingBlock.baseFeePerGas._hex);
      tx.maxPriorityFeePerGas =
        // (mempoolTransaction.maxPriorityFeePerGas &&
        //   mempoolTransaction.maxPriorityFeePerGas._hex) ||
        '0x0';
    }

    tx = FeeMarketEIP1559Transaction.fromTxData(tx, this.network);
    this.logger.debug(`${JSON.stringify(tx)}`);

    const signedTx = tx.sign(Buffer.from(this.walletSecret, 'hex'));
    const liquidationTx = '0x' + signedTx.serialize().toString('hex');

    // Avoiding error mismatch EIP-1559 gasPrice != maxFeePerGas
    if (mempoolTransaction.gasPrice !== mempoolTransaction.maxFeePerGas) {
      this.logger.debug(
        `Avoiding error mismatch EIP-1559 gasPrice != maxFeePerGas`,
      );
      mempoolTransaction.gasPrice = mempoolTransaction.maxFeePerGas;
    }

    const transactionBundle = [
      {
        signedTransaction: this.provider.ethersSerializeTx(mempoolTransaction),
      },
      {
        signedTransaction: liquidationTx,
      },
    ];

    const updateLiqStatus = {};
    updateLiqStatus[protocol] = {};
    for (
      let targetBlock = pendingBlock.number + 1;
      targetBlock < pendingBlock.number + 4;
      targetBlock += 1
    ) {
      this.logger.debug(`Bundle target block: ${targetBlock}`);
      const signedTransactions =
        await this.provider.flashbotsProvider.signBundle(transactionBundle);
      const simulation = await this.provider.flashbotsProvider.simulate(
        signedTransactions,
        targetBlock,
      );
      // Using TypeScript discrimination
      if ('error' in simulation) {
        this.logger.debug(
          `Bundle Simulation Error: ${simulation.error.message}`,
        );
        updateLiqStatus[protocol][accountAddress] = {
          status: 'Errored',
          timestamp: new Date().getTime(),
        };
        this.amqpConnection.publish(
          'liquidator-exchange',
          'liquidations-called',
          updateLiqStatus,
        );
        this.rebase();
        return;
      } else {
        this.logger.debug(
          `Bundle Simulation Success: ${JSON.stringify(simulation, null, 2)}`,
        );
      }

      const bundleSubmission =
        await this.provider.flashbotsProvider.sendRawBundle(
          signedTransactions,
          targetBlock,
        );
      this.logger.debug('Bundle submitted, waiting');

      if ('error' in bundleSubmission) {
        this.logger.error(bundleSubmission.error.message);
      }
      const waitResponse = await bundleSubmission.wait();
      this.logger.debug(
        `Wait Response: ${FlashbotsBundleResolution[waitResponse]}`,
      );

      if (waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh) {
        updateLiqStatus[protocol][accountAddress] = {
          status: 'Errored',
          timestamp: new Date().getTime(),
        };
        this.amqpConnection.publish(
          'liquidator-exchange',
          'liquidations-called',
          updateLiqStatus,
        );
        this.rebase();
        return;
      } else if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
        this.logger.debug(` Successful at block ${targetBlock}!`);

        updateLiqStatus[protocol][accountAddress] = {
          status: 'Processed',
          timestamp: new Date().getTime(),
        };

        this.amqpConnection.publish(
          'liquidator-exchange',
          'liquidations-called',
          updateLiqStatus,
        );
        return;
      }
      // else {
      //   this.logger.debug({
      //     bundleStats: await this.provider.flashbotsProvider.getBundleStats(
      //       simulation.bundleHash,
      //       targetBlock,
      //     ),
      //     userStats: await this.provider.flashbotsProvider.getUserStats(),
      //   });
      // }
    }
    updateLiqStatus[protocol][accountAddress] = {
      status: 'Errored',
      timestamp: new Date().getTime(),
    };
    this.amqpConnection.publish(
      'liquidator-exchange',
      'liquidations-called',
      updateLiqStatus,
    );
    this.rebase();
  }

  signAndSend(tx, profitUSD, protocol, accountAddress, gasPrices) {
    tx.nonce = Web3Utils.toHex(this.nonce);
    this.logger.debug('Setting nonce: ' + this.nonce);
    this.nonce += 1;
    tx.gasLimit = Web3Utils.toHex(tx.gasLimit);
    // tx.gasPrice = Web3Utils.toHex(parseInt(tx.gasPrice));

    const sentTx = this._send(this._sign(tx, gasPrices));
    const sentDate = new Date();

    sentTx.on('transactionHash', (hash) => {
      const network =
        this.network.chain === 'mainnet' ? '' : this.network.chain + '.';
      this.logger.debug(`<https://${network}etherscan.io/tx/${hash}>`);

      this.amqpConnection.publish('liquidator-exchange', 'tx-created', {
        tx,
        sentDate,
        hash,
        protocol,
      });
    });
    // After receiving receipt, log success and rebase
    sentTx.on('receipt', (receipt) => {
      this.logger.debug(` Successful at block ${receipt.blockNumber}!`);
      this.amqpConnection.publish('liquidator-exchange', 'tx-processed', {
        receipt,
        profitUSD,
      });

      const updateLiqStatus = {};
      updateLiqStatus[protocol] = {};
      updateLiqStatus[protocol][accountAddress] = {
        status: 'Processed',
        timestamp: new Date().getTime(),
      };

      this.amqpConnection.publish(
        'liquidator-exchange',
        'liquidations-called',
        updateLiqStatus,
      );
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
        this.signAndSend(tx, profitUSD, protocol, accountAddress, {});
      } else if (
        errStr.includes('replacement transaction underpriced') ||
        errStr.includes('already known')
      ) {
        this.logger.debug('Attempting rebase: ' + errStr);
        this.rebase();
      }
      // Certain errors are expected (and handled naturally by structure
      // of this queue) so we don't need to log them:
      else {
        this.logger.debug('Off-chain ' + errStr);
        this.rebase();
      }
      this.amqpConnection.publish('liquidator-exchange', 'tx-processed', {
        tx,
        errStr,
        profitUSD,
      });

      const updateLiqStatus = {};
      updateLiqStatus[protocol] = {};
      updateLiqStatus[protocol][accountAddress] = {
        status: 'Errored',
        timestamp: new Date().getTime(),
      };

      this.amqpConnection.publish(
        'liquidator-exchange',
        'liquidations-called',
        updateLiqStatus,
      );
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
  _sign(tx, gasPrices) {
    // Set tx.from here since it must be signed by its sender.
    // i.e. this is the only valid value for tx.from
    tx.from = this.walletAddress;
    tx.type = '0x02';

    if (gasPrices && gasPrices.maxFeePerGas && gasPrices.maxPriorityFeePerGas) {
      tx = { ...tx, ...gasPrices };
    } else {
      tx.maxPriorityFeePerGas =
        '0x' + (this.maxPriorityFeePerGasGwei * 10 ** 9).toString(16); // 25000000000 WEI, 25 GWEI for eth 1600 and gas 400000 gives around 16USDs
      // putting a very high fee as I got Transaction maxFeePerGas (2500000020) is too low for the next block, which has a baseFeePerGas of 7757457203
      // we need to implement here a block-level base fee fetch: https://ethereum.stackexchange.com/questions/123453/error-transactions-maxfeepergas-0-is-less-than-the-blocks-basefeepergas-52
      tx.maxFeePerGas =
        '0x' +
        (
          +(this.gasPriceGwei + this.maxFeePerGasAddToPrice).toFixed() *
          10 ** 9
        ).toString(16); // 30000000000 or 30 GWEI for eth 1600 and gas 400000 gives around 19.2USDs
    }

    if (tx.maxFeePerGas < tx.maxPriorityFeePerGas) {
      tx.maxPriorityFeePerGas = tx.maxFeePerGas;
      this.logger.debug(
        `Avoiding "maxFeePerGas cannot be less than maxPriorityFeePerGas" `,
      );
    }

    // Need to have the following LOCALLY as chain needs to go 31337
    tx.chainId = '0x' + this.network.chainId.toString(16);
    tx = FeeMarketEIP1559Transaction.fromTxData(tx, this.network);

    // this.logger.debug(`${JSON.stringify(tx)}`);

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

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-polled',
  })
  async updatePricesHandler(msg: Record<string, any>) {
    if (
      msg.prices['0x0000000000000000000000000000000000000000'] &&
      msg.prices['0x0000000000000000000000000000000000000000'].price
    ) {
      this.ethPrice = msg.prices['0x0000000000000000000000000000000000000000'];
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'prices-updated',
  })
  public async pricesUpdated(msg: Record<string, any>) {
    for (const priceObj of msg.prices) {
      if (
        priceObj.underlyingAddress ===
          '0x0000000000000000000000000000000000000000' &&
        this.ethPrice.blockNumber < priceObj.blockNumber
      ) {
        this.ethPrice = {
          blockNumber: priceObj.blockNumber,
          price: priceObj.price,
        };
      }
    }
  }
}
