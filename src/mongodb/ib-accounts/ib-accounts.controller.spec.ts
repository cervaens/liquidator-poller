import { Test, TestingModule } from '@nestjs/testing';
import { IbAccountsController } from './ib-accounts.controller';

describe('IbAccountsController', () => {
  let controller: IbAccountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IbAccountsController],
    }).compile();

    controller = module.get<IbAccountsController>(IbAccountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
