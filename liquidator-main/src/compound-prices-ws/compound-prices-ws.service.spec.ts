import { Test, TestingModule } from '@nestjs/testing';
import { CompoundPricesWsService } from './compound-prices-ws.service';

describe('CompoundPricesWsService', () => {
  let service: CompoundPricesWsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompoundPricesWsService],
    }).compile();

    service = module.get<CompoundPricesWsService>(CompoundPricesWsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
