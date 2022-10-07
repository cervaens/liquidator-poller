import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletService],
      imports: [AppModule],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('Get last nonce', async () => {
    expect(service).toBeDefined();
    const nonce = await service.getLowestLiquidNonce();
    expect(nonce).toEqual(expect.any(Number));
  });
});
