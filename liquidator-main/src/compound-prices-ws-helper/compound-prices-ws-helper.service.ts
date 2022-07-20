import { Injectable, Logger, Inject } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
// import { Web3ProviderService } from './web3-provider/web3-provider.service';
import Web3 from 'web3';
import { CtokenController } from 'src/mongodb/ctoken/ctoken.controller';
import uniswapAnchorAbi from './abis/uniswapAnchoredView_ABI.json';
import { AbiItem } from 'web3-utils';

@Injectable()
export class CompoundPricesWsHelperService {
  private readonly logger = new Logger(CompoundPricesWsHelperService.name);
  private uniswapAnchorContract;
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly ctoken: CtokenController,
    @Inject('WEB3PROV') private conWeb3: Web3,
    @Inject('WEB3WS') private web3Ws: Web3,
  ) {}

  async onModuleInit(): Promise<void> {
    this.uniswapAnchorContract = await this.initUniswapAnchoredViewContract();
  }

  anchorInput = [
    {
      type: 'uint256',
      name: 'anchorPrice',
    },
    {
      type: 'uint256',
      name: 'oldTimestamp',
    },
    {
      type: 'uint256',
      name: 'newTimestamp',
    },
  ];

  logToObject = (tx: Record<string, any>) => {
    const result = this.conWeb3.eth.abi.decodeLog(
      this.anchorInput,
      tx.data,
      tx.topics,
    );
    return result;
  };

  async getTokenInfo(tokenHash: string) {
    return await this.uniswapAnchorContract.methods
      .getTokenConfigBySymbolHash(tokenHash)
      .call();
  }

  async initUniswapAnchoredViewContract() {
    // init new web3 with our infura key

    try {
      return new this.conWeb3.eth.Contract(
        uniswapAnchorAbi as AbiItem[],
        process.env.COMPOUND_UNISWAPANCHORVIEW_ADDRESS ||
          '0x65c816077C29b557BEE980ae3cC2dCE80204A0C5',
      );
    } catch (err) {
      this.logger.debug('Error instanciating unisapAnchor contract');
    }
  }
}
