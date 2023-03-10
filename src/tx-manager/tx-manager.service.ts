import { Injectable, Logger } from '@nestjs/common';
import liquidatorAbi from './abis/Liquidator.json';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';

import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { WalletService } from './wallet/wallet.service';
import { AppService } from 'src/app.service';
import * as CompoundConfig from './protocolsConfigs/compound';
import * as IronBankConfig from './protocolsConfigs/ironbank';

@Injectable()
export class TxManagerService {
  private readonly logger = new Logger(TxManagerService.name);
  private liquidatorContract: Contract;
  private address: string =
    process.env.LIQUIDATOR_ADDRESS ||
    '0xCa1D199b6F53Af7387ac543Af8e8a34455BBe5E0';
  private liquidationsStatus: Record<string, Record<string, any>> = {};
  private realTxsEnabled =
    process.env.LIQUIDATIONS_REAL_TXS_ENABLED === 'true' ? true : false;
  private waiterEnabled =
    process.env.LIQUIDATIONS_WAITER_ENABLED === 'true' ? true : false;
  private disabledProtocols: Record<string, boolean> = {
    Compound: process.env.COMPOUND_DISABLE_TXS === 'true',
    IronBank: process.env.IRONBANK_DISABLE_TXS === 'true',
  };

  private protocolTxConfig = {
    Compound: CompoundConfig,
    IronBank: IronBankConfig,
  };
  constructor(
    private readonly provider: Web3ProviderService,
    private readonly wallet: WalletService,
    private readonly amqpConnection: AmqpConnection,
    private readonly appService: AppService,
  ) {}

  // For now Im hardcoding this, but this shouldnt be here, should be in the contract
  private readonly protocolAddresses = {
    Compound: {
      compTroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
      eth: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
    },
    IronBank: {
      compTroller: '0xAB1c342C7bf5Ec5F02ADEA1c2270670bCa144CbB',
      eth: '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393',
    },
  };

  async onModuleInit(): Promise<void> {
    this.liquidatorContract = await this.initLiquidatorContract();
    await this.subscribeToLiquidatorEvents();
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'tx-protocol-status',
  })
  async updateProtocolStatus(msg: Record<string, any>) {
    this.protocolTxConfig[msg.protocol].disabled = !msg.enabled;

    this.logger.debug(
      `Changed protocol ${msg.protocol} enabled to ${msg.enabled}`,
    );
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'set-real-txs',
  })
  setRealTxs(value) {
    this.realTxsEnabled = value;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'set-waiter-candidate',
  })
  setWaiterCandidates(value) {
    this.waiterEnabled = value;
  }

  getNrLiquidations(): Record<string, number> {
    const result = { total: 0 };
    for (const protocol of Object.keys(this.liquidationsStatus)) {
      result[protocol] = Object.keys(this.liquidationsStatus[protocol]).length;
      result.total += result[protocol];
    }
    return result;
  }

  getCurrentLiquidations(): Record<string, Record<string, any>> {
    return this.liquidationsStatus;
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidate-many',
    queue: 'liquidate-many',
  })
  async liquidateMany(msg: Record<string, any>) {
    const now = new Date().getTime();

    // const promises = [];

    for (const candidate of msg.candidatesArray) {
      // We might receive liquidate-many while on init and we need to wait for liquidation statuses
      if (!this.liquidationsStatus[candidate.protocol]) {
        this.logger.debug(`No liquidation status yet. Discarding liquidations`);
        continue;
      }
      const { repayToken, profitUSD, seizeToken, borrower } = candidate;
      if (this.protocolTxConfig[candidate.protocol].disabled) {
        this.logger.debug(
          `Protocol ${
            candidate.protocol
          } is disabled. Discarding liquidation for Borrower ${borrower}
          Repaying ${repayToken} with amount ${candidate.amount}
          Seizing  ${seizeToken} for estimated profit of ${parseFloat(
            profitUSD,
          ).toFixed(2)} USD`,
        );
        continue;
      }

      this.logger.debug(
        `Liquidating account from ${candidate.protocol}
        Borrower ${borrower}
        Repaying ${repayToken} with amount ${candidate.amount}
        Seizing  ${seizeToken} for estimated profit of ${parseFloat(
          profitUSD,
        ).toFixed(2)} USD`,
      );

      if (
        this.liquidationsStatus[candidate.protocol] &&
        this.liquidationsStatus[candidate.protocol][borrower] &&
        ((this.liquidationsStatus[candidate.protocol][borrower].status.match(
          /ongoing|Errored|Processed/,
        ) &&
          this.liquidationsStatus[candidate.protocol][borrower].timestamp >
            now - (parseInt(process.env.LIQUIDATIONS_CLEAN_TIME) || 3600000)) ||
          !this.liquidationsStatus[candidate.protocol][borrower].timestamp)
      ) {
        if (
          this.liquidationsStatus[candidate.protocol][borrower].timestamp ===
          Infinity
        ) {
          this.logger.debug(`Account ${borrower} is blacklisted`);
        } else {
          this.logger.debug(
            `Account ${borrower} was recently tried for liquidation`,
          );
        }
        continue;
      } else if (
        this.liquidationsStatus[candidate.protocol] &&
        this.liquidationsStatus[candidate.protocol][borrower] &&
        this.liquidationsStatus[candidate.protocol][borrower].status ===
          'Reverted' &&
        ((msg.revertMsgWaitFor &&
          (msg.revertMsgWaitFor !==
            this.liquidationsStatus[candidate.protocol][borrower]
              .revertMsgWaitFor ||
            !this.protocolTxConfig[candidate.protocol].checkRevertMsgWaitFor(
              msg,
              candidate,
            ))) ||
          (!msg.revertMsgWaitFor && msg.fromMempool))
      ) {
        this.logger.debug(
          `Account ${borrower} status is "Reverted" and no Blocknative update for any of its tokens.`,
        );
        continue;
      }

      this.liquidationsStatus[candidate.protocol][borrower] = {
        status: 'ongoing',
        timestamp: now,
      };
      this.amqpConnection.publish(
        'liquidator-exchange',
        'liquidations-called',
        this.liquidationsStatus,
      );

      let method: Record<string, any> = {};
      if (msg.amountFromBlockNative) {
        this.logger.debug(
          `Here we'll need to call a different method including the amount`,
        );
        method = this.liquidatorContract.methods.liquidate(
          this.protocolTxConfig[candidate.protocol].addresses.compTroller,
          this.protocolTxConfig[candidate.protocol].addresses.eth,
          borrower,
          repayToken,
          // parseInt(amount).toString(),
          seizeToken,
        );
      } else {
        method = this.liquidatorContract.methods.liquidate(
          this.protocolTxConfig[candidate.protocol].addresses.compTroller,
          this.protocolTxConfig[candidate.protocol].addresses.eth,
          borrower,
          repayToken,
          // parseInt(amount).toString(),
          seizeToken,
        );
        // method = this.liquidatorContract.methods.liquidateBundle(
        //   this.provider.web3.utils.toWei('0.001', 'ether'),
        // );
      }

      const gasLimit = 2000000;

      // const gasPrice = await this.wallet.getGasPrice();
      // const gasPrice = '3000000000';
      const tx = this.wallet._txFor(this.address, method, gasLimit);

      // Dont estimate gas, create tx
      // We dont want to create a tx without estimateGas if status is ongoing/errored
      // we want to go through estimateGas first
      if (
        msg.fromMempool &&
        (!this.liquidationsStatus[candidate.protocol] ||
          !this.liquidationsStatus[candidate.protocol][borrower] ||
          (this.liquidationsStatus[candidate.protocol] &&
            this.liquidationsStatus[candidate.protocol][borrower] &&
            !this.liquidationsStatus[candidate.protocol][borrower].status.match(
              /Errored|Processed/,
            )))
      ) {
        if (this.realTxsEnabled) {
          this.logger.debug(
            ` Requesting TX creation for account ${borrower} in protocol ${candidate.protocol} due to a mempool update`,
          );
          this.amqpConnection.publish('liquidator-exchange', 'execute-tx', {
            tx,
            profitUSD,
            protocol: candidate.protocol,
            accountAddress: borrower,
            estimatedGas: 1000000,
            ...msg,
          });
        } else {
          this.logger.debug(
            `Real liquidations disabled. Tx in ${
              candidate.protocol
            } for account ${borrower} with tx: ${JSON.stringify(
              tx,
            )} was not sent`,
          );
        }
      } else {
        this.wallet
          .estimateGas(tx)
          .then((estimatedGas) => {
            tx.gasLimit =
              tx.gasLimit && tx.gasLimit < (estimatedGas || 0)
                ? estimatedGas
                : tx.gasLimit;

            if (this.realTxsEnabled) {
              this.logger.debug(
                ` Requesting TX creation for account ${borrower} in protocol ${candidate.protocol} `,
              );
              this.amqpConnection.publish('liquidator-exchange', 'execute-tx', {
                tx,
                profitUSD,
                protocol: candidate.protocol,
                accountAddress: borrower,
                estimatedGas,
                ...msg,
              });
            } else {
              this.logger.debug(
                `Real liquidations disabled. Tx in ${
                  candidate.protocol
                } for account ${borrower} with tx: ${JSON.stringify(
                  tx,
                )} was not sent`,
              );
            }
          })
          .catch((e) => {
            this.logger.debug(
              `Revert during gas estimation: ${e.name} ${e.message} for account  ${candidate.borrower}, repaying amount ${candidate.amount} of ${candidate.repayToken}, seizing ${candidate.seizeToken}`,
            );
            const updateLiqStatus = {};
            const timestamp = new Date().getTime();
            updateLiqStatus[candidate.protocol] = {};
            updateLiqStatus[candidate.protocol][borrower] = {
              status: 'Reverted',
              timestamp,
            };

            if (
              this.waiterEnabled &&
              this.protocolTxConfig[candidate.protocol].revertMsgWaitFor
            ) {
              for (const message of Object.keys(
                this.protocolTxConfig[candidate.protocol].revertMsgWaitFor,
              )) {
                if (e.message.match(message)) {
                  updateLiqStatus[candidate.protocol].revertMsgWaitFor =
                    this.protocolTxConfig[candidate.protocol].revertMsgWaitFor;
                  this.amqpConnection.publish(
                    'liquidator-exchange',
                    'waiter-candidate',
                    {
                      time: timestamp,
                      ...candidate,
                      message:
                        this.protocolTxConfig[candidate.protocol]
                          .revertMsgWaitFor[message],
                    },
                  );
                }
              }
            }

            this.amqpConnection.publish(
              'liquidator-exchange',
              'liquidations-called',
              updateLiqStatus,
            );
          });
      }
    }
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidations-called',
  })
  async updateLiquidationsList(msg: Record<string, any>) {
    for (const protocol of Object.keys(msg)) {
      this.liquidationsStatus[protocol] = {
        ...this.liquidationsStatus[protocol],
        ...msg[protocol],
      };
    }

    this.logger.debug(
      'Current nr liqs: ' + JSON.stringify(this.getNrLiquidations()),
    );
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'liquidations-clear',
  })
  async clearLiquidationsList(msg: Record<string, string>) {
    for (const protocol of Object.keys(this.liquidationsStatus)) {
      if (msg.protocol && msg.protocol !== protocol) {
        continue;
      }
      if (
        msg.account &&
        this.liquidationsStatus[protocol] &&
        this.liquidationsStatus[protocol][msg.account]
      ) {
        delete this.liquidationsStatus[protocol][msg.account];
      } else if (!msg.account) {
        this.liquidationsStatus[protocol] = {};
      }
    }
    this.logger.debug(
      'Current nr liqs: ' + JSON.stringify(this.getNrLiquidations()),
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
        name: 'repayCToken',
        type: 'address',
      },
      {
        name: 'seizeCToken',
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
