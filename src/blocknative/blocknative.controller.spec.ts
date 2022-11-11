import { Test, TestingModule } from '@nestjs/testing';
import { BlocknativeController } from './blocknative.controller';

describe('BlocknativeController', () => {
  let controller: BlocknativeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlocknativeController],
    }).compile();

    controller = module.get<BlocknativeController>(BlocknativeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
