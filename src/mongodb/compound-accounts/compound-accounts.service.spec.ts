import { Test, TestingModule } from '@nestjs/testing';
import { CompoundAccountsService } from './compound-accounts.service';

describe('CompoundAccountsService', () => {
  let service: CompoundAccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompoundAccountsService],
    }).compile();

    service = module.get<CompoundAccountsService>(CompoundAccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
