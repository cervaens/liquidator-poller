import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from 'src/app.service';
import { Web3ProviderService } from 'src/web3-provider/web3-provider.service';
import { BlocknativeService } from './blocknative.service';
import candidate from '../../test/candidate.json';
import mintMessage from '../../test/mintMessage.json';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('BlocknativeService', () => {
  let service: BlocknativeService;
  let appService: AppService;
  // jest.setTimeout(10000);
  beforeAll(async () => {
    // jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [BlocknativeService, AppService, Web3ProviderService],
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
    }).compile();

    // await module.init();
    service = module.get<BlocknativeService>(BlocknativeService);
    appService = module.get<AppService>(AppService);
    jest.spyOn(appService, 'amItheMaster').mockImplementation(() => true);
    jest.spyOn(service, 'fetch').mockImplementation(() => Promise.resolve({}));
    // Web3ProviderService module initiates websockets and sleep is needed not to throw a warning
    // message regarding "You are trying to `import` a file after the Jest environment has been torn down"
    await sleep(1000);
  });

  // afterAll(() => {});

  it('Get validators and Add/Remove addresses to list', async () => {
    expect(service).toBeDefined();

    await service.getValidators();

    const res = await service.addAggregatorToList('cETH');
    expect(res.has('cETH')).toBe(true);
    const resTest = await service.addAggregatorToList('cTest');
    expect(resTest.has('cTest')).toBe(false);
    const resRem = await service.removeAggregatorFromList('cETH');
    expect(resRem.has('cETH')).toBe(false);
  });

  it('Test waiter candidate messages', async () => {
    expect(service).toBeDefined();
    const time = new Date().getTime();

    await service.waiterCandidateMessage({
      time,
      message: 'Mint',
      repayToken: candidate.liqBorrow.tokenAddress,
      amount: 1,
      seizeToken: candidate.liqCollateral.tokenAddress,
      borrower: candidate.address,
      profitUSD: candidate.profitUSD,
      protocol: candidate.protocol,
    });
    expect(
      service.waiterCandidates[candidate.protocol][candidate.address].borrower,
    ).toEqual(candidate.address);

    await service.deleteFromCandidatesList({
      timestamp: time + 1000,
      action: 'deleteBelowTimestamp',
    });
    expect(
      service.waiterCandidates[candidate.protocol][candidate.address],
    ).not.toBeDefined();
  });

  it('Send mint message', async () => {
    expect(service).toBeDefined();
    const time = new Date().getTime();
    await service.waiterCandidateMessage({
      time,
      message: 'Mint',
      repayToken: candidate.liqBorrow.tokenAddress,
      amount: 1,
      seizeToken: candidate.liqCollateral.tokenAddress,
      borrower: candidate.address,
      profitUSD: candidate.profitUSD,
      protocol: candidate.protocol,
    });
    const ret = service.processMint(mintMessage);
    expect(ret).toEqual(1);
  });

  it('Send unhealthy candidate message', async () => {
    expect(service).toBeDefined();
    const time = new Date().getTime();
    await service.waiterCandidateMessage({
      time,
      message: 'Mint',
      repayToken: candidate.liqBorrow.tokenAddress,
      amount: 1,
      seizeToken: candidate.liqCollateral.tokenAddress,
      borrower: candidate.address,
      profitUSD: candidate.profitUSD,
      protocol: candidate.protocol,
    });
    const newTime = time + 2000;
    service.updateWaiterCandidates({
      time: newTime,
      protocol: candidate.protocol,
      address: candidate.address,
    });
    expect(
      service.waiterCandidates[candidate.protocol][candidate.address].time,
    ).toEqual(newTime);
  });
});
