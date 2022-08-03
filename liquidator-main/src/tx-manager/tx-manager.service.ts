import { Inject, Injectable, Logger } from '@nestjs/common';
import Web3 from 'web3';

import liquidatorAbi from './abis/FlashLiquidatorABI.json';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';

import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { WalletService } from './wallet/wallet.service';

@Injectable()
export class TxManagerService {
  private readonly logger = new Logger(TxManagerService.name);
  private liquidatorContract: Contract;
  private address: string =
    process.env.LIQUIDATOR_ADDRESS ||
    '0x0a17FabeA4633ce714F1Fa4a2dcA62C3bAc4758d';
  private liquidationsStatus: Record<string, Record<string, any>> = {};
  private nonce: number;

  constructor(
    @Inject('WEB3PROV') private conn: Web3,
    private readonly provider: Web3ProviderService,
    private readonly wallet: WalletService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async onModuleInit(): Promise<void> {
    this.liquidatorContract = await this.initLiquidatorContract();
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidate-many',
    queue: 'liquidate-many',
  })
  async liquidateMany(msg: Array<Record<string, any>>) {
    const now = new Date().getTime();

    // const promises = [];

    for (const candidate of msg) {
      const { repayCToken, amount, seizeCToken, borrower } = candidate;
      if (
        this.liquidationsStatus[borrower] &&
        this.liquidationsStatus[borrower].timestamp > now - 3600000
      ) {
        return;
      }
      this.logger.debug('Liquidating account: ' + borrower);
      // TODO: ENABLE THIS IN PROD
      // this.liquidationsStatus[borrower] = { status: 'ongoing', timestamp: now };
      const method = this.liquidatorContract.methods.flashSwap(
        repayCToken,
        parseInt(amount).toString(),
        seizeCToken,
        borrower,
      );

      const gasLimit = 1163000;

      // const gasPrice = await this.wallet.getGasPrice();
      // const gasPrice = '3000000000';
      const tx = this.wallet._txFor(this.address, method, gasLimit);

      this.wallet
        .estimateGas(tx)
        .then((estimated) => {
          tx.gasLimit =
            tx.gasLimit && tx.gasLimit < (estimated || 0)
              ? estimated
              : tx.gasLimit;

          this.amqpConnection.publish('liquidator-exchange', 'execute-tx', tx);
        })
        .catch((e) => {
          this.logger.debug(
            `Revert during gas estimation: ${e.name} ${e.message} for account  ${candidate.borrower}, repaying amount ${candidate.amount} of ${candidate.repayCToken}, seizing ${candidate.seizeCToken}`,
          );
        });
      // );
    }
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
