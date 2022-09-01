import { Injectable, Logger } from '@nestjs/common';
import Web3 from 'web3';
import AWSHttpProvider from '@aws/web3-http-provider';
import AWSWebsocketProvider from '@aws/web3-ws-provider';

const WSoptions = {
  timeout: 3600000, // ms -- 60 min

  //  Useful if requests result are large
  clientConfig: {
    maxReceivedFrameSize: 100000000, // bytes - default: 1MiB
    maxReceivedMessageSize: 100000000, // bytes - default: 8MiB

    // Useful to keep a connection alive
    keepalive: true,
    keepaliveInterval: 60000, // ms
  },

  // Enable auto reconnection
  reconnect: {
    auto: true,
    delay: 5000, // ms
    maxAttempts: 1024,
    onTimeout: true,
  },
};

const WSProvider = (url) => {
  return new Web3(new Web3.providers.WebsocketProvider(url, WSoptions));
};

const HTTPProvider = (path) => {
  return new Web3(path);
};

export const web3Con = HTTPProvider(
  process.env.WEB3_HTTP_PROVIDER ||
    `https://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
);

export const web3Ws = WSProvider(
  process.env.WEB3_WSS_PROVIDER ||
    `wss://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
);

@Injectable()
export class Web3ProviderService {
  private readonly logger = new Logger(Web3ProviderService.name);
  public web3: Web3;
  public web3Ws: Web3;
  constructor() {
    switch (process.env.WEB3_PROVIDER) {
      case 'AWS':
        this.web3 = new Web3(
          new AWSHttpProvider(process.env.AMB_HTTP_ENDPOINT),
        );
        this.web3Ws = new Web3(
          new AWSWebsocketProvider(process.env.AMB_WS_ENDPOINT, WSoptions).on(
            'close',
            (e) => console.error('WS End', e),
          ),
        );
        break;
      default:
        this.web3 = HTTPProvider(
          process.env.WEB3_HTTP_PROVIDER ||
            `https://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
        );
        this.web3Ws = WSProvider(
          process.env.WEB3_WSS_PROVIDER ||
            `wss://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
        );
        break;
    }

    this.web3.eth
      .getNodeInfo()
      .then((str) => this.logger.debug('Web3 provider connected: ' + str));
    this.web3Ws.eth
      .getNodeInfo()
      .then((str) =>
        this.logger.debug('Web3 websocket provider connected: ' + str),
      );
  }
}
