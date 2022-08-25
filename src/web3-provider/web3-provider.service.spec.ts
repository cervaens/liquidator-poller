import { Test, TestingModule } from '@nestjs/testing';
import { Web3ProviderService } from './web3-provider.service';

describe('Web3ProviderService', () => {
  let service: Web3ProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Web3ProviderService],
    }).compile();

    service = module.get<Web3ProviderService>(Web3ProviderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
