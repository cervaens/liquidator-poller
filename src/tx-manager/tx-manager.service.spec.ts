import { RabbitMQModule, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AppService } from 'src/app.service';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { TxManagerService } from './tx-manager.service';
import { WalletService } from './wallet/wallet.service';
import candidate from '../../test/candidate.json';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let answerWaiterMsg: Record<string, any>;

@Injectable()
class SubscribeService {
  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'waiter-candidate',
  })
  async waiterCandidateMessage(msg: Record<string, any>) {
    answerWaiterMsg = msg;
  }
}

describe('TxManagerService', () => {
  let service: TxManagerService;
  let walletService: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TxManagerService,
        WalletService,
        SubscribeService,
        Web3ProviderService,
        AppService,
      ],
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        RabbitMQModule.forRoot(RabbitMQModule, {
          exchanges: [
            {
              name: 'liquidator-exchange',
              type: 'topic',
            },
          ],
          uri: JSON.parse(process.env.RABBIT_MQ_URI_ARRAY) || [
            'amqp://localhost:5673',
            'amqp://localhost:5672',
          ],
          connectionInitOptions: { wait: false, timeout: 3000 },
          connectionManagerOptions: {
            reconnectTimeInSeconds: 0.0001,
          },
        }),
      ],
      // exports: [RabbitMQModule],
    }).compile();

    await module.init();
    service = module.get<TxManagerService>(TxManagerService);
    walletService = module.get<WalletService>(WalletService);
  });

  it('send waiter-message', async () => {
    expect(service).toBeDefined();

    jest
      .spyOn(walletService, 'estimateGas')
      .mockImplementation(() =>
        Promise.reject(
          new Error('Error I cannot send value to fallback error'),
        ),
      );

    service.updateLiquidationsList({ IronBank: { something: true } });

    await service.liquidateMany({
      candidatesArray: [
        {
          repayToken: candidate.liqBorrow.tokenAddress,
          amount: 1,
          seizeToken: candidate.liqCollateral.tokenAddress,
          borrower: candidate.address,
          profitUSD: candidate.profitUSD,
          protocol: candidate.protocol,
        },
      ],
    });

    await sleep(300);
    expect(answerWaiterMsg.borrower).toEqual(candidate.address);
  });

  it('receive liquidate-many from blocknative waiter-message', async () => {
    expect(service).toBeDefined();

    jest
      .spyOn(walletService, 'estimateGas')
      .mockImplementation(() =>
        Promise.reject(
          new Error('Error I cannot send value to fallback error'),
        ),
      );

    const waiterObj = {
      IronBank: {},
    };
    waiterObj.IronBank[candidate.address] = {
      status: 'Reverted',
      revertMsgWaitFor: 'Mint',
      timestamp: 123,
    };

    service.updateLiquidationsList(waiterObj);

    await service.liquidateMany({
      candidatesArray: [
        {
          repayToken: candidate.liqBorrow.tokenAddress,
          amount: 1,
          seizeToken: candidate.liqCollateral.tokenAddress,
          borrower: candidate.address,
          profitUSD: candidate.profitUSD,
          protocol: candidate.protocol,
        },
      ],
      amountFromBlockNative: 300000000,
      revertMsgWaitFor: 'Mint',
      gasPrices: {
        maxFeePerGas: 123,
        maxPriorityFeePerGas: 456,
      },
      watchedAddress: candidate.liqBorrow.tokenAddress,
    });

    expect(answerWaiterMsg.borrower).toEqual(candidate.address);
  });
});
