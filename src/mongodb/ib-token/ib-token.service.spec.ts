import { Test, TestingModule } from '@nestjs/testing';
import { IbTokenService } from './ib-token.service';

describe('IbTokenService', () => {
  let service: IbTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IbTokenService],
    }).compile();

    service = module.get<IbTokenService>(IbTokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
