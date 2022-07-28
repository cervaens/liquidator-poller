import { Test, TestingModule } from '@nestjs/testing';
import { CompoundPricesWsController } from './compound-prices-ws.controller';

describe('CompoundPricesWsController', () => {
  let controller: CompoundPricesWsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompoundPricesWsController],
    }).compile();

    controller = module.get<CompoundPricesWsController>(CompoundPricesWsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
