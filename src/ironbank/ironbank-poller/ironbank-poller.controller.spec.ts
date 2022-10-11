import { Test, TestingModule } from '@nestjs/testing';
import { IronbankPollerController } from './ironbank-poller.controller';

describe('IronbankPollerController', () => {
  let controller: IronbankPollerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IronbankPollerController],
    }).compile();

    controller = module.get<IronbankPollerController>(IronbankPollerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
