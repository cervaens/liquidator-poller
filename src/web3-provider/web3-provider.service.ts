import { Injectable, Logger } from '@nestjs/common';
import Web3 from 'web3';
import AWSHttpProvider from '@aws/web3-http-provider';
import AWSWebsocketProvider from '@aws/web3-ws-provider';

const WSoptions = {
  timeout: 5000, // ms -- 60 min

  //  Useful if requests result are large
  clientConfig: {
    maxReceivedFrameSize: 10000000000, // bytes - default: 1MiB
    maxReceivedMessageSize: 10000000000, // bytes - default: 8MiB

    // Useful to keep a connection alive
    keepalive: true,
    keepaliveInterval: 1000, // ms
    dropConnectionOnKeepaliveTimeout: true,
    keepaliveGracePeriod: 4000, // ms
  },

  // Enable auto reconnection
  reconnect: {
    auto: true,
    delay: 1000, // ms
    // maxAttempts: 1024,
    onTimeout: false,
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
  public web3Providers = [];
  public web3WsProviders = [];
  constructor() {
    const providersList = JSON.parse(process.env.WEB3_PROVIDERS) || ['AWS'];
    const providersWsList = JSON.parse(process.env.WEB3_WS_PROVIDERS) || [
      'AWS',
    ];
    for (const provider of providersList) {
      this.logger.debug('Provider: ' + provider);
      switch (provider) {
        case 'AWS':
          this.web3Providers.push(
            new Web3(new AWSHttpProvider(process.env.AMB_HTTP_ENDPOINT)),
          );
          if (providersWsList.includes(provider)) {
            this.web3WsProviders.push(
              new Web3(
                new AWSWebsocketProvider(
                  process.env.AMB_WS_ENDPOINT,
                  WSoptions,
                ).on('close', (e) => console.error('WS End', e)),
              ),
            );
          }
          break;
        case 'Alchemy':
          this.web3Providers.push(
            HTTPProvider(
              process.env.ALCHEMY_WEB3_HTTP_PROVIDER ||
                `https://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
            ),
          );
          if (providersWsList.includes(provider)) {
            this.web3WsProviders.push(
              WSProvider(
                process.env.ALCHEMY_WEB3_WSS_PROVIDER ||
                  `wss://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
              ),
            );
          }
          break;
        case 'Infura':
          this.web3Providers.push(
            HTTPProvider(
              `https://:${process.env.INFURA_SECRET}@${process.env.INFURA_HTTP_PROVIDER}`,
            ),
          );
          if (providersWsList.includes(provider)) {
            this.web3WsProviders.push(
              WSProvider(
                process.env.INFURA_WSS_PROVIDER ||
                  `wss://mainnet.infura.io/ws/v3/7350eecf18634051b74cd8aa9dbb7161`,
              ),
            );
          }
          break;
        default:
          this.web3Providers.push(
            HTTPProvider(
              process.env.WEB3_HTTP_PROVIDER ||
                `https://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
            ),
          );
          this.web3WsProviders.push(
            WSProvider(
              process.env.WEB3_WSS_PROVIDER ||
                `wss://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
            ),
          );
          break;
      }
    }
    this.web3 = this.web3Providers[0];
    this.web3Ws = this.web3WsProviders[0];

    this.web3Providers.forEach((element) => {
      element.eth
        .getNodeInfo()
        .then((str) => this.logger.debug('Web3 provider connected: ' + str));
    });

    this.web3WsProviders.forEach((element) => {
      element.eth
        .getNodeInfo()
        .then((str) =>
          this.logger.debug('Web3 websocket provider connected:  ' + str),
        );
    });
  }
}
