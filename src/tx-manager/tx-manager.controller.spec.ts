import { Test, TestingModule } from '@nestjs/testing';
import { TxManagerController } from './tx-manager.controller';

describe('TxManagerController', () => {
  let controller: TxManagerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TxManagerController],
    }).compile();

    controller = module.get<TxManagerController>(TxManagerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
