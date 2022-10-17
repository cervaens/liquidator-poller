import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import {
  closeInMongodConnection,
  rootMongooseTestModule,
} from '../../../test-utils/mongo/MongooseTestModule';
import { Transactions, TransactionsSchema } from './transactions.schema';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const msg = {
    tx: {
      data: '1234567891000000000000000000000000ee0b0271918ba62b939437af831efc689365112b000000000000000000000000ee0b0271918ba62b939437af831efc689365112b000000000000000000000000ee0b0271918ba62b939437af831efc689365112b',
      gasLimit: 100,
    },
    hash: '0x01',
    sentDate: new Date(),
  };

  const receipt = {
    transactionHash: msg.hash,
    receiptDate: new Date(),
    gasUsed: 123,
    effectiveGasPrice: 124,
    blockNumber: 112,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseModule.forFeature([
          { name: Transactions.name, schema: TransactionsSchema },
        ]),
      ],
      providers: [TransactionsService],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('create transaction', async () => {
    expect(service).toBeDefined();
    await service.createTransaction(msg);
    const objDB = await service.getTransaction(msg.hash);
    expect(objDB._id).toEqual(msg.hash);
    await service.updateTransaction({ receipt });
    const objDBupdated = await service.getTransaction(msg.hash);
    expect(objDBupdated.gasUsed).toEqual(123);
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });
});
