import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Body, Controller, Logger } from '@nestjs/common';
import { IronBankToken } from './classes/IronBankToken';
import { IbTokenService } from './ib-token.service';

@Controller('ib-token')
export class IbTokenController {
  constructor(
    private readonly ibTokenService: IbTokenService,
    private readonly amqpConnection: AmqpConnection,
  ) {}
  private readonly logger = new Logger(IbTokenController.name);
  private protocol = 'IronBank';

  async onApplicationBootstrap(): Promise<void> {
    // At start time of the worker we get the itokens from db if they exist
    setTimeout(async () => {
      const iTokens = await this.ibTokenService.findAll();
      if (iTokens.length > 0) {
        const tokenObj = {};
        for (const token of iTokens) {
          tokenObj[token.symbol] = token;
        }
        this.amqpConnection.publish('liquidator-exchange', 'tokens-polled', {
          tokens: tokenObj,
          protocol: this.protocol,
        });
      }
    }, parseInt(process.env.WAIT_TIME_FOR_OTHER_WORKERS));
  }

  async createMany(@Body() ctokens: Array<IronBankToken>) {
    return await this.ibTokenService.createMany(ctokens);
  }
}
