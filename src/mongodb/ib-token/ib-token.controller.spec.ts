import { Test, TestingModule } from '@nestjs/testing';
import { IbTokenController } from './ib-token.controller';

describe('IbTokenController', () => {
  let controller: IbTokenController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IbTokenController],
    }).compile();

    controller = module.get<IbTokenController>(IbTokenController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
