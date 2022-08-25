import { Module } from '@nestjs/common';
import { web3Con, web3Ws } from './web3-provider.service';

@Module({
  providers: [
    {
      provide: 'WEB3',
      useValue: web3Con,
    },
    {
      provide: 'WEB3WS',
      useValue: web3Ws,
    },
  ],
  exports: ['WEB3', 'WEB3WS'],
})
export class Web3ProviderModule {}
