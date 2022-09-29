import { Test, TestingModule } from '@nestjs/testing';
import { IronbankPricesService } from './ironbank-prices.service';

describe('IronbankPricesService', () => {
  let service: IronbankPricesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IronbankPricesService],
    }).compile();

    service = module.get<IronbankPricesService>(IronbankPricesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
