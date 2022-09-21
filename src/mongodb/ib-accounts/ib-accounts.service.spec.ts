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

  it('should be defined', async () => {
    expect(service).toBeDefined();
    await service.accountEnterMarket('testAccount', 'testMarket');
    const res = await service.findAll();
    expect(res[0]._id).toEqual('testAccount');
    expect(res[0].tokens[0].address).toEqual('testMarket');
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });
});
