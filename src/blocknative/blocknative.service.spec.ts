import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { BlocknativeService } from './blocknative.service';

describe('BlocknativeService', () => {
  let service: BlocknativeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlocknativeService],
      imports: [AppModule],
    }).compile();

    service = module.get<BlocknativeService>(BlocknativeService);
  });

  it('Add address to list', async () => {
    expect(service).toBeDefined();
    const res = await service.addAddressToList(
      '0x10234648d5a63618751d006886268ae3550d0dfd',
    );
    expect(res.status).toEqual(200);
    const resRem = await service.removeAddressFromList(
      '0x10234648d5a63618751d006886268ae3550d0dfd',
    );
    expect(resRem.status).toEqual(200);
  });
});
