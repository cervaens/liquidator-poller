/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unused-vars */

const Web3 = require('web3');

const AWSHttpProvider = require('@aws/web3-http-provider');

const AWSWebsocketProvider = require('@aws/web3-ws-provider');
const validatorABI = require('./ValidatorABI.json');

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

const providerWs = new Web3(
  new AWSWebsocketProvider(
    'wss://nd-loh4pdwx2zdobgyrnxi3njy6ma.wss.ethereum.managedblockchain.us-east-1.amazonaws.com',
    WSoptions,
  ),
);

async function testSubscription() {
  let counter = 0;
  let validators = [];

  const proxyContracts = {
    AAVE: '0x0238247E71AD0aB272203Af13bAEa72e99EE7c3c',
    BAT: '0xeBa6F33730B9751a8BA0b18d9C256093E82f6bC2',
    COMP: '0xE270B8E9d7a7d2A7eE35a45E43d17D56b3e272b1',
    DAI: '0xb2419f587f497CDd64437f1B367E2e80889631ea',
    ETH: '0x264BDDFD9D93D48d759FBDB0670bE1C6fDd50236',
    FEI: '0xDe2Fa230d4C05ec0337D7b4fc10e16f5663044B0',
    FRAX: '0xfAD527D1c9F8677015a560cA80b7b56950a61FE1',
    LINK: '0xBcFd9b1a97cCD0a3942f0408350cdc281cDCa1B1',
    LUSD: '0xBfcbADAa807E25aF90424c8173645B945a401eca',
    MATIC: '0x44750a79ae69D5E9bC1651E099DFFE1fb8611AbA',
    MKR: '0xbA895504a8E286691E7dacFb47ae8A3A737e2Ce1',
    RAI: '0xF0148Ddd8bA74D294E67E65FE1F3f0CD2F43CA8a',
    REP: '0x90655316479383795416B615B61282C72D8382C1',
    SUSHI: '0x875acA7030B75b5D8cB59c913910a7405337dFf7',
    UNI: '0x70f4D236FD678c9DB41a52d28f90E299676d9D90',
    WBTC: '0x4846efc15CC725456597044e6267ad0b3B51353E',
    YFI: '0xBa4319741782151D2B1df4799d757892EFda4165',
    ZRX: '0x5c5db112c98dbe5977A4c37AD33F8a4c9ebd5575',
  };

  for (let validatorContract of Object.values(proxyContracts)) {
    try {
      const proxyContract = new providerWs.eth.Contract(
        validatorABI,
        validatorContract,
      );
      const aggregators = await proxyContract.methods
        .getAggregators()
        .call()
        .catch((err) => {
          console.log(`Couldn't get aggregators: ${err}`);
        });
      validators.push(aggregators.current);
    } catch (err) {
      console.log('Error instanciating unisapAnchor contract: ' + err);
    }
  }

  console.log(validators);
  // providerWs.eth
  //   .subscribe('pendingTransactions', function (error, result) {
  //     //   if (!error) console.log(result);
  //     if (error) console.log(`Error in subscription: ${error}`);
  //   })
  //   .on('data', async (transaction) => {
  //     counter += 1;
  //     if (counter % 100 === 0) console.log(counter);

  //     try {
  //       const tx = await providerWs.eth.getTransaction(transaction);
  //       if (tx && validators.includes(tx.to)) {
  //         console.log(new Date());
  //         console.log(tx);
  //       }
  //     } catch (err) {
  //       console.error(`Error ${err}`);
  //     }
  //   });
}

testSubscription();
