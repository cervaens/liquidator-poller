import { RabbitMQModule, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AppService } from 'src/app.service';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { TxManagerService } from './tx-manager.service';
import { WalletService } from './wallet/wallet.service';

const candidate = {
  liqCollateral: {
    valueUSD: 143907.36560171607,
    symbol_underlying: 'DAI',
    tokenAddress: '0x8e595470Ed749b85C6F7669de83EAe304C2ec68F',
    units_underlying: 14379775432550.389,
  },
  liqBorrow: {
    valueUSD: 134166.35469327884,
    symbol_underlying: 'WETH',
    tokenAddress: '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393',
    units_underlying: 111667572238638060000,
    decimals_underlying: 18,
  },
  address: '0xb08f95FF2616c345831E91FD397D199D35C9c38A',
  _id: '0xb08f95FF2616c345831E91FD397D199D35C9c38A',
  closeFactor: 0.5,
  liquidationIncentive: 1.08,
  protocol: 'IronBank',
  tokens: [
    {
      address: '0x8e595470Ed749b85C6F7669de83EAe304C2ec68F',
      borrow_balance_underlying: 0,
      supply_balance_itoken: 1360403682731540,
    },
    {
      address: '0x48759F220ED983dB51fA7A8C0D2AAb8f3ce4166a',
      borrow_balance_underlying: 0,
      supply_balance_itoken: 51756028953,
    },
    {
      address: '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393',
      borrow_balance_underlying: 111667572238638060000,
      supply_balance_itoken: 0,
    },
    {
      address: '0x76Eb2FE28b36B3ee97F3Adae0C69606eeDB2A37c',
      borrow_balance_underlying: 0,
      supply_balance_itoken: 1481228283,
    },
  ],
  health: 0.9653819463582144,
  lastUpdated: 1668687156932,
  profitUSD: 5105.029796079265,
  totalDepositUSD: 129521.77662958408,
  totalBorrowUSD: 134166.35469327884,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let answer: Record<string, any>;

@Injectable()
class SubscribeService {
  @RabbitSubscribe({
    exchange: 'liquidator-exchange',
    routingKey: 'waiter-candidate',
  })
  async waiterCandidateMessage(msg: Record<string, any>) {
    answer = msg;
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
    expect(answer.borrower).toEqual(candidate.address);
  });
});
