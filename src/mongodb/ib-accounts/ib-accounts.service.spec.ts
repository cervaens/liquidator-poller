import { Test, TestingModule } from '@nestjs/testing';
import { IbAccountsService } from './ib-accounts.service';
import {
  closeInMongodConnection,
  rootMongooseTestModule,
} from '../../../test-utils/mongo/MongooseTestModule';
import { MongooseModule } from '@nestjs/mongoose';
import { IBaccounts, IBaccountsSchema } from './ib-accounts.schema';

describe('IbAccountsService', () => {
  let service: IbAccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseModule.forFeature([
          { name: IBaccounts.name, schema: IBaccountsSchema },
        ]),
      ],
      providers: [IbAccountsService],
    }).compile();

    service = module.get<IbAccountsService>(IbAccountsService);
  });

  it('Account enters market', async () => {
    expect(service).toBeDefined();
    await service.accountEntersMarket('testAccount', 'testMarket');
    await service.accountEntersMarket('testAccount', 'testMarket');
    await service.accountEntersMarket('testAccount', 'testMarket2');
    const res = await service.findAll();
    expect(res.length).toEqual(1);
    expect(res[0].tokens.length).toEqual(2);
    expect(res[0]._id).toEqual('testAccount');
    expect(res[0].tokenList).toContain('testMarket2');
  });

  it('Account exits market', async () => {
    expect(service).toBeDefined();
    await service.accountEntersMarket('testAccountExit', 'testMarket');
    await service.accountExitsMarket('testAccountExit', 'testMarket');
    const res = await service.findAll();
    expect(res[0].tokenList).not.toContain('testMarket');
  });

  it('Update balances', async () => {
    expect(service).toBeDefined();
    await service.accountEntersMarket('testAccountBalance', 'testMarket');
    await service.updateBalances('testAccountBalance', 'testMarket', 123, 456);
    const res = await service.findAccount('testAccountBalance');
    expect(res.tokens[0].supply_balance_underlying).toEqual(456);
    expect(res.tokens[0].borrow_balance_underlying).toEqual(123);
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });
});
