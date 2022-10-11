import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import {
  closeInMongodConnection,
  rootMongooseTestModule,
} from '../../../test-utils/mongo/MongooseTestModule';
import { IBcontrol, IBcontrolSchema } from './ib-control.schema';
import { IbControlService } from './ib-control.service';

describe('IbControlService', () => {
  let service: IbControlService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseModule.forFeature([
          { name: IBcontrol.name, schema: IBcontrolSchema },
        ]),
      ],
      providers: [IbControlService],
    }).compile();

    service = module.get<IbControlService>(IbControlService);
  });

  it('Update control item', async () => {
    expect(service).toBeDefined();
    await service.updateItem('lastBlockNumberUnitrollerPoller', 15457563);
    const res = await service.findAll();
    expect(res[0].lastBlockNumberUnitrollerPoller).toEqual(15457563);
  });

  it('Get control obj', async () => {
    expect(service).toBeDefined();
    await service.updateItem('lastBlockNumberUnitrollerPoller', 15457563);
    const res = await service.getControlObj();
    expect(res).toBeInstanceOf(Object);
    expect(res.lastBlockNumberUnitrollerPoller).toEqual(15457563);
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });
});
