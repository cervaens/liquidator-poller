import { Test, TestingModule } from '@nestjs/testing';
import { CompoundPollerService } from './compound-poller.service';

describe('CompoundPollerService', () => {
  let service: CompoundPollerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompoundPollerService],
    }).compile();

    service = module.get<CompoundPollerService>(CompoundPollerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
