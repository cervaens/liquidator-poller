import { Controller, Logger } from '@nestjs/common';
import { IBcontrol } from './ib-control.schema';
import { IbControlService } from './ib-control.service';

@Controller('ib-control')
export class IbControlController {
  constructor(private readonly ibControlService: IbControlService) {}
  private readonly logger = new Logger(IbControlController.name);

  async updateItem(item: string, value: any): Promise<IBcontrol> {
    return this.ibControlService.updateItem(item, value);
  }
}
