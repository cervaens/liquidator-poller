import { Test, TestingModule } from '@nestjs/testing';
import { CompoundAccountsController } from './compound-accounts.controller';

describe('CompoundAccountsController', () => {
  let controller: CompoundAccountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompoundAccountsController],
    }).compile();

    controller = module.get<CompoundAccountsController>(
      CompoundAccountsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
