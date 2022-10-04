import { Injectable, Logger } from '@nestjs/common';
import liquidatorAbi from './abis/Liquidator.json';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';

import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { WalletService } from './wallet/wallet.service';
import { AppService } from 'src/app.service';

@Injectable()
export class TxManagerService {
  private readonly logger = new Logger(TxManagerService.name);
  private liquidatorContract: Contract;
  private address: string =
    process.env.LIQUIDATOR_ADDRESS ||
    '0xCa1D199b6F53Af7387ac543Af8e8a34455BBe5E0';
  private liquidationsStatus: Record<string, Record<string, any>> = {};
  private nonce: number;

  constructor(
    private readonly provider: Web3ProviderService,
    private readonly wallet: WalletService,
    private readonly amqpConnection: AmqpConnection,
    private readonly appService: AppService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.liquidatorContract = await this.initLiquidatorContract();
    await this.subscribeToLiquidatorEvents();
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
      const { repayToken, profitUSD, seizeToken, borrower } = candidate;
      if (
        this.liquidationsStatus[borrower] &&
        this.liquidationsStatus[borrower].timestamp > now - 3600000
      ) {
        return;
      }
      this.logger.debug(
        `Liquidating account from ${candidate.protocol}
        Borrower ${borrower}
        Repaying ${repayToken} with amount ${candidate.amount}
        Seizing  ${seizeToken} for estimated profit of ${parseFloat(
          profitUSD,
        ).toFixed(2)} USD`,
      );
      // TODO: ENABLE THIS IN PROD
      this.liquidationsStatus[borrower] = { status: 'ongoing', timestamp: now };
      const method = this.liquidatorContract.methods.liquidate(
        borrower,
        repayToken,
        // parseInt(amount).toString(),
        seizeToken,
      );

      const gasLimit = 2000000;

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

          this.amqpConnection.publish('liquidator-exchange', 'execute-tx', {
            tx,
            profitUSD,
          });
        })
        .catch((e) => {
          this.logger.debug(
            `Revert during gas estimation: ${e.name} ${e.message} for account  ${candidate.borrower}, repaying amount ${candidate.amount} of ${candidate.repayToken}, seizing ${candidate.seizeToken}`,
          );
        });
      // );
    }
    this.amqpConnection.publish(
      'liquidator-exchange',
      'liquidations-called',
      this.liquidationsStatus,
    );
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidations-called',
  })
  async updateLiquidationsList(msg: Record<string, any>) {
    this.liquidationsStatus;
    this.liquidationsStatus = { ...this.liquidationsStatus, ...msg };
    this.logger.debug(
      'Current nr liqs: ' + Object.keys(this.liquidationsStatus).length,
    );
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidations-clear',
  })
  async clearLiquidationsList() {
    this.liquidationsStatus;
    this.liquidationsStatus = {};
    this.logger.debug(
      'Current nr liqs: ' + Object.keys(this.liquidationsStatus).length,
    );
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

  async subscribeToLiquidatorEvents() {
    // init new web3 with our infura key

    const options = {
      address: this.address,
    };

    const input = [
      {
        name: 'borrower',
        type: 'address',
      },
      {
        name: 'repayToken',
        type: 'address',
      },
      {
        name: 'seizeToken',
        type: 'address',
      },
      {
        name: 'loanAmount',
        type: 'uint256',
      },
      {
        name: 'seizeAmount',
        type: 'uint256',
      },
      {
        name: 'profit',
        type: 'uint256',
      },
    ];

    this.provider.web3Ws.eth.subscribe('logs', options, async (err, tx) => {
      if (err) return;

      if (this.appService.amItheMaster()) {
        try {
          const decoded = this.provider.web3.eth.abi.decodeLog(
            input,
            tx.data,
            tx.topics,
          );

          this.amqpConnection.publish('liquidator-exchange', 'got-event', {
            transactionHash: tx.transactionHash,
            loanAmount: decoded.loanAmount,
            profit: decoded.profit,
            seizeAmount: decoded.seizeAmount,
          });
        } catch (err) {
          this.logger.debug('Err: ' + err);
        }
      }
    });
  }
}
