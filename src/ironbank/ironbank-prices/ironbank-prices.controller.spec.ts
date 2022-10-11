import { Test, TestingModule } from '@nestjs/testing';
import { IronbankPricesController } from './ironbank-prices.controller';

describe('IronbankPricesController', () => {
  let controller: IronbankPricesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IronbankPricesController],
    }).compile();

    controller = module.get<IronbankPricesController>(IronbankPricesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
