import { Test, TestingModule } from '@nestjs/testing';
import { IbControlController } from './ib-control.controller';

describe('IbControlController', () => {
  let controller: IbControlController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IbControlController],
    }).compile();

    controller = module.get<IbControlController>(IbControlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
