import { Controller, Logger } from '@nestjs/common';
import { IbTokenController } from 'src/mongodb/ib-token/ib-token.controller';
import { IronbankPollerService } from './ironbank-poller.service';

@Controller('ironbank-poller')
export class IronbankPollerController {
  constructor(
    private readonly ibPollerService: IronbankPollerService,
    private readonly ibTokenController: IbTokenController,
  ) {}

  private tokens = [];
  private readonly logger = new Logger(IronbankPollerController.name);

  async onApplicationBootstrap(): Promise<void> {
    const tokenIBAddresses = await this.pollIBTokens();
  }

  async pollIBTokens() {
    this.logger.debug('Calling IronBank tokens endpoint');
    this.tokens = (
      await this.ibPollerService.fetchIBtokens({ comptroller: 'eth' })
    ).tokens;
    await this.ibTokenController.createMany(this.tokens);
    // return this.tokens.map((token: CompoundToken) => ({
    //   underlyingAddress: token.underlyingAddress,
    //   underlyingSymbol: token.underlyingSymbol,
    // }));
  }
}
