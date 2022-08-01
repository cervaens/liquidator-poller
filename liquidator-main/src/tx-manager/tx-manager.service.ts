import { Inject, Injectable, Logger } from '@nestjs/common';
import Web3 from 'web3';
import Big from 'big.js';

import liquidatorAbi from './abis/FlashLiquidatorABI.json';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';

import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { WalletService } from './wallet/wallet.service';

@Injectable()
export class TxManagerService {
  private readonly logger = new Logger(TxManagerService.name);
  private liquidatorContract: Contract;
  private address: string =
    process.env.LIQUIDATOR_ADDRESS ||
    '0x0a17FabeA4633ce714F1Fa4a2dcA62C3bAc4758d';
  private network: Record<string, any>;
  private liquidations: Record<string, Record<string, any>>;

  constructor(
    @Inject('WEB3PROV') private conn: Web3,
    private readonly provider: Web3ProviderService,
    private readonly wallet: WalletService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.liquidatorContract = await this.initLiquidatorContract();
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

    const gasLimit = new Big(1163000);
    const nonce = await this.wallet.getLowestLiquidNonce();
    const gasPrice = await this.wallet.getGasPrice();
    // const gasPrice = '3000000000';
    const tx = this.wallet._txFor(this.address, method, gasLimit, gasPrice);

    let estimated;
    try {
      estimated = await this.wallet.estimateGas(tx);
    } catch (e) {
      this.logger.debug(
        `Revert during gas estimation: ${e.name} ${e.message} for account  ${borrower}, repaying amount ${amount} of ${repayCToken}, seizing ${seizeCToken}`,
      );
      // console.log(e.name + " " + e.message);
      // this._removeCandidate(borrowers[0]);
      // this._tx = null;
      // this._revenue = 0;
      // return;
    }

    // TODO: sometimes when restarting app some messages in the queue will come immediately
    // and somehow estimated is undefined, so for now the condition below falls back to zero
    tx.gasLimit =
      tx.gasLimit && tx.gasLimit.lt(estimated || 0) ? estimated : tx.gasLimit;

    const sentTx = this.wallet.signAndSend(tx, nonce);

    sentTx.on('transactionHash', (hash) => {
      this.logger.debug(
        `<https://${this.wallet.network.chain}.etherscan.io/tx/${hash}>`,
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
