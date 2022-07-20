import { Injectable } from '@nestjs/common';
import Web3 from 'web3';

const WSProvider = (url) => {
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

  return new Web3(new Web3.providers.WebsocketProvider(url, WSoptions));
};

const HTTPProvider = (path) => {
  return new Web3(path);
};

export const web3Con = HTTPProvider(
  `https://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
);

export const web3Ws = WSProvider(
  `wss://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
);

@Injectable()
export class Web3ProviderService {
  public web3 = HTTPProvider(
    `https://eth-mainnet.alchemyapi.io/v2/***REMOVED***`,
  );

  //   web3P() {
  //     return this.web3Provider;
  //   }
}
