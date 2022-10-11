import { Test, TestingModule } from '@nestjs/testing';
import { IronbankPollerService } from './ironbank-poller.service';

describe('IronbankPollerService', () => {
  let service: IronbankPollerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IronbankPollerService],
    }).compile();

    service = module.get<IronbankPollerService>(IronbankPollerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
