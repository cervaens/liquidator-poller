import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { web3Con } from 'src/web3-provider/web3-provider.service';
import { Transactions, TransactionsDocument } from './transactions.schema';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectModel(Transactions.name)
    private transactionsModel: Model<TransactionsDocument>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'tx-processed',
    queue: 'tx-processed',
  })
  public async updateTransaction(msg: Record<string, Record<string, any>>) {
    if (!msg.receipt) {
      return;
    }

    const costInEth =
      msg.receipt.gasUsed * msg.receipt.effectiveGasPrice * 10 ** -18;

    this.logger.debug(
      'Updating transaction in DB from transaction processed: ' +
        msg.receipt.transactionHash,
    );

    await this.transactionsModel
      .findByIdAndUpdate(msg.receipt.transactionHash, {
        receiptDate: new Date(),
        gasUsed: msg.receipt.gasUsed,
        effectiveGasPrice: msg.receipt.effectiveGasPrice,
        blockNumber: msg.receipt.blockNumber,
        costInEth,
        estimatedProfitUSD: msg.profitUSD,
      })
      .setOptions({ upsert: true })
      .catch((err) => {
        this.logger.error('Couldnt update transaction: ' + err);
      });
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'tx-created',
    queue: 'tx-created',
  })
  public async createTransaction(
    msg: Record<string, any | Record<string, any>>,
  ) {
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      0: compTroller,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      1: ethAddress,
      2: borrower,
      3: repayToken,
      4: seizeToken,
    } = web3Con.eth.abi.decodeParameters(
      ['address', 'address', 'address'],
      msg.tx.data.slice(10),
    );

    await this.transactionsModel
      .findByIdAndUpdate(msg.hash, {
        borrower,
        repayToken,
        seizeToken,
        createdDate: new Date(),
        sentDate: msg.sentDate,
        gasLimit: msg.tx.gasLimit,
        protocol: msg.protocol,
      })
      .setOptions({ upsert: true })
      .catch((err) => {
        this.logger.error('Couldnt insert transaction: ' + err);
      });
  }

  getTransaction(txHash) {
    return this.transactionsModel.findById(txHash).lean();
  }

  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'got-event',
    queue: 'got-event',
  })
  public async updateFromEvent(msg: Record<string, any>) {
    this.logger.debug(
      'Updating transaction in DB from event tx: ' + JSON.stringify(msg),
    );
    await this.transactionsModel
      .findByIdAndUpdate(msg.transactionHash, {
        loanAmount: msg.loanAmount,
        profit: msg.profit,
        seizeAmount: msg.seizeAmount,
      })
      .setOptions({ upsert: true })
      .catch((err) => {
        this.logger.error('Couldnt update from event: ' + err);
      });
  }
}
