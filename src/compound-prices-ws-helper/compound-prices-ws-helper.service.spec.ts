import { Test, TestingModule } from '@nestjs/testing';
import { CompoundPricesWsHelperService } from './compound-prices-ws-helper.service';

describe('CompoundPricesWsHelperService', () => {
  let service: CompoundPricesWsHelperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompoundPricesWsHelperService],
    }).compile();

    service = module.get<CompoundPricesWsHelperService>(CompoundPricesWsHelperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
