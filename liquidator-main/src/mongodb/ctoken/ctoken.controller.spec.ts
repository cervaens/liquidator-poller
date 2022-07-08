import { Test, TestingModule } from '@nestjs/testing';
import { CtokenController } from './ctoken.controller';

describe('CtokenController', () => {
  let controller: CtokenController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CtokenController],
    }).compile();

    controller = module.get<CtokenController>(CtokenController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
