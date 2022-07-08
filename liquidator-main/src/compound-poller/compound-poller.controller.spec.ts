import { Test, TestingModule } from '@nestjs/testing';
import { CompoundPollerController } from './compound-poller.controller';

describe('CompoundPollerController', () => {
  let controller: CompoundPollerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompoundPollerController],
    }).compile();

    controller = module.get<CompoundPollerController>(CompoundPollerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
