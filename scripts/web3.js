/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Web3 = require('web3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWSHttpProvider = require('@aws/web3-http-provider');

// const provider = new Web3(
//   new AWSHttpProvider(
//     'https://nd-loh4pdwx2zdobgyrnxi3njy6ma.ethereum.managedblockchain.us-east-1.amazonaws.com',
//   ),
// );

// const provider = new Web3(
//   'wss://eth-mainnet.alchemyapi.io/v2/DwvILB0y2CqFzqv75RyM9rbYTV4vsmEe',
// );

const provider = new Web3('http://127.0.0.1:8545');

const cTokens = [
  { address: '0xf5dce57282a584d2746faf1593d3121fcac444dc', symbol: 'cSAI' },
  { address: '0x80a2ae356fc9ef4305676f7a3e2ed04e12c33946', symbol: 'cYFI' },
  { address: '0x158079ee67fce2f58472a96584a73c7ab9ac95c1', symbol: 'cREP' },
  { address: '0x7713dd9ca933848f6819f38b8352d9a15ea73f67', symbol: 'cFEI' },
  { address: '0x95b4ef2869ebd94beb4eee400a99824bf5dc325b', symbol: 'cMKR' },
  { address: '0xe65cdb6479bac1e22340e4e755fae7e509ecd06c', symbol: 'cAAVE' },
  { address: '0x041171993284df560249b57358f931d9eb7b925d', symbol: 'cUSDP' },
  { address: '0x12392f67bdf24fae0af363c24ac620a2f67dad86', symbol: 'cTUSD' },
  { address: '0x4b0181102a0112a2ef11abee5563bb4a3176c9d7', symbol: 'cSUSHI' },
  { address: '0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407', symbol: 'cZRX' },
  { address: '0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e', symbol: 'cBAT' },
  { address: '0xc11b1268c1a384e55c48c2391d8d480264a3a7f4', symbol: 'cWBTC' },
  { address: '0xface851a4921ce59e912d19329929ce6da6eb0c7', symbol: 'cLINK' },
  { address: '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', symbol: 'cDAI' },
  { address: '0x70e36f6bf80a52b3b46b3af8e106cc0ed743e8e4', symbol: 'cCOMP' },
  { address: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5', symbol: 'cETH' },
  { address: '0x35a18000230da775cac24873d00ff85bccded550', symbol: 'cUNI' },
  { address: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9', symbol: 'cUSDT' },
  { address: '0xccf4429db6322d5c611ee964527d42e5d685dd6a', symbol: 'cWBTC2' },
  { address: '0x39aa39c021dfbae8fac545936693ac917d5e7563', symbol: 'cUSDC' },
];

const liquidationTopic =
  '0x298637f684da70674f26509b10f07ec2fbc77a335ab1e7d6215a4b2484d8bb52';

const ibTokens = [
  { address: '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393', symbol: 'iWETH' },
  { address: '0x8e595470Ed749b85C6F7669de83EAe304C2ec68F', symbol: 'iDAI' },
  { address: '0x9e8E207083ffd5BDc3D99A1F32D1e6250869C1A9', symbol: 'iMIM' },
  { address: '0xE7BFf2Da8A2f619c2586FB83938Fa56CE803aA16', symbol: 'iLINK' },
  { address: '0xFa3472f7319477c9bFEcdD66E4B948569E7621b9', symbol: 'iYFI' },
  { address: '0x12A9cC33A980DAa74E00cc2d1A0E74C57A93d12C', symbol: 'iSNX' },
  { address: '0x8Fc8BFD80d6A9F17Fb98A373023d72531792B431', symbol: 'iWBTC' },
  { address: '0x48759F220ED983dB51fA7A8C0D2AAb8f3ce4166a', symbol: 'iUSDT' },
  { address: '0x76Eb2FE28b36B3ee97F3Adae0C69606eeDB2A37c', symbol: 'iUSDC' },
  { address: '0x226F3738238932BA0dB2319a8117D9555446102f', symbol: 'iSUSHI' },
  { address: '0xecaB2C76f1A8359A06fAB5fA0CEea51280A97eCF', symbol: 'iGBP' },
  { address: '0x00e5c0774A5F065c285068170b20393925C84BF3', symbol: 'iEUR' },
  { address: '0xA8caeA564811af0e92b1E044f3eDd18Fa9a73E4F', symbol: 'iEURS' },
  { address: '0x30190a3B52b5AB1daF70D46D72536F5171f22340', symbol: 'iAAVE' },
  { address: '0x7736Ffb07104c0C400Bb0CC9A7C228452A732992', symbol: 'iDPI' },
  { address: '0x86BBD9ac8B9B44C95FFc6BAAe58E25033B7548AA', symbol: 'iAUD' },
  { address: '0xB8c5af54bbDCc61453144CF472A9276aE36109F9', symbol: 'iCRV' },
  { address: '0x215F34af6557A6598DbdA9aa11cc556F5AE264B1', symbol: 'iJPY' },
  { address: '0x3c9f5385c288cE438Ed55620938A4B967c080101', symbol: 'iKRW' },
  { address: '0xE0B57FEEd45e7D908f2d0DaCd26F113Cf26715BF', symbol: 'iCVX' },
  { address: '0xa7c4054AFD3DbBbF5bFe80f41862b89ea05c9806', symbol: 'iSUSD' },
  { address: '0x1b3E95E8ECF7A7caB6c4De1b344F94865aBD12d5', symbol: 'iCHF' },
  { address: '0xFEEB92386A055E2eF7C2B598c872a4047a7dB59F', symbol: 'iUNI' },
];

function testSubscription() {
  const input = [
    {
      name: 'borrower',
      type: 'address',
    },
    {
      name: 'repayToken',
      type: 'address',
    },
    {
      name: 'seizeToken',
      type: 'address',
    },
    {
      name: 'loanAmount',
      type: 'uint256',
    },
    {
      name: 'seizeAmount',
      type: 'uint256',
    },
    {
      name: 'profit',
      type: 'uint256',
    },
  ];
  const options = {
    address: '0xc029784F0B3cCEd83c9f98FdB857989b4FB9D1E7',
    fromBlock: 1,
  };

  provider.eth.subscribe('logs', options, async (err, tx) => {
    if (err) {
      console.log(err);
      return;
    }

    try {
      const decoded = provider.eth.abi.decodeLog(input, tx.data, tx.topics);
      console.log(decoded);
    } catch (err) {
      console.log('Err: ' + err);
    }
  });
}

function testDecode2() {
  // const data =
  //   '0x0000000000000000000000fab2a673593336cd7cefeaa17e354c48000021480303000f0d040502070c11060110080a0b0e091200000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000130000000000000000000000000000000000000000000000000000000005ef46680000000000000000000000000000000000000000000000000000000005f293b40000000000000000000000000000000000000000000000000000000005f418eb0000000000000000000000000000000000000000000000000000000005f418eb0000000000000000000000000000000000000000000000000000000005f467130000000000000000000000000000000000000000000000000000000005f467130000000000000000000000000000000000000000000000000000000005f4fcf50000000000000000000000000000000000000000000000000000000005f5270d0000000000000000000000000000000000000000000000000000000005f5ab3f0000000000000000000000000000000000000000000000000000000005f5ab3f0000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000000000000005f5e7080000000000000000000000000000000000000000000000000000000005f5e8890000000000000000000000000000000000000000000000000000000005f5eaef0000000000000000000000000000000000000000000000000000000005f5eaef0000000000000000000000000000000000000000000000000000000005f5eb3b0000000000000000000000000000000000000000000000000000000005f5eb3b';
  const data =
    '0xc98075390000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000006800001010101010100010101000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000046000000000000000000000009f88d5f42679b75c4a0244716f695ef3000276ce031a1c08040502011b09121507141e1d0310000b180c19110e130f0a0d160617000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000001f0000000000000000000000000000000000000000000000000000001bfbe1db800000000000000000000000000000000000000000000000000000001c038ccc940000000000000000000000000000000000000000000000000000001c040c4fc00000000000000000000000000000000000000000000000000000001c050073c00000000000000000000000000000000000000000000000000000001c06b724700000000000000000000000000000000000000000000000000000001c088f603f0000000000000000000000000000000000000000000000000000001c0941dfce0000000000000000000000000000000000000000000000000000001c0941dfce0000000000000000000000000000000000000000000000000000001c09e646f10000000000000000000000000000000000000000000000000000001c0b1c7a600000000000000000000000000000000000000000000000000000001c0b1c7a600000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c0ecc1a220000000000000000000000000000000000000000000000000000001c14707a800000000000000000000000000000000000000000000000000000001c149c80ba0000000000000000000000000000000000000000000000000000001c16e216c00000000000000000000000000000000000000000000000000000001c25cbcf670000000000000000000000000000000000000000000000000000001c28d72fa00000000000000000000000000000000000000000000000000000001c321f5b000000000000000000000000000000000000000000000000000000001c34dd42800000000000000000000000000000000000000000000000000000001c3dbed1c00000000000000000000000000000000000000000000000000000001c42b14c800000000000000000000000000000000000000000000000000000001c86d9b960000000000000000000000000000000000000000000000000000000000000000bbe81429e2c160fb9a27c2341bc3e1033a2e57b7e2db03942dc6a40e554bec9798546b8a3c7229ed77b962a75e13969e7ac7071c157d39b982cae1d94c39b11221fee1c3cd413033785277fdc1156e5053ea08bc96d7fcbc48a7fb1b1fa43a3f888d2abe1913202b0643a983c8e0833eaaf876a05f3b7d436472386a6389eafd880b329aa93f27dcd33638262a308ab962c9dbc0a56ad07cd121182c8c920fc35b842e600abb57b69d20af955944670e427808c658e8a05789b876c26a47f789afc2344f1c0cf2d4ad1da3061f563d495d66bc2803eb2da3c48c4d13496ebaf8bc880794fac7f665175c2d1c7e9a208c7cbae81bbd2b5c72addf9f2b4ffd887044a9ec779d085fe42619a62efed5f38156c52d43fc2dca756c1bbd452b02497160065ba28b8c93ea6eb2329532db021b8d8eefb4ee8b2274a14746f5f5d00abe2917d658cd93766a28b72802296ce877b75302f5e03cce17693bd7af43386ce34000000000000000000000000000000000000000000000000000000000000000b2e637bb03ccafb50077beb6a246d35582249aedfc1098a27051e7f54b2a54f7c66cee3316ec0add8ea6842ff891f8c3e02fa3e74fb2479b15933591b6c70e8f92e88f7ef80b5cf135f38676b137130755d447dbf7b17649fa9c7eabfbf3021d4774934db6dd12e24665f0c25f4b5f91c2a354497c51a5fd8164de2cdbb3fe82404970056e029edc8c9cd8cc8419da7110b97e5271fa26b2bcdb303721236dbdf72f920d96b80bde1f1a966d44f2112a0e386012d6ff3ddf6a0a19dd7cc963fae14109cdb88e6a5001aab2d1c0b01959ecbde3f5e65e3ce8d8b3605c7b01e1fc65e126f617b64be2f7b57447f0a54f2ddfe55892ba28b6f483a2ccea15c24ebc65ef4626ea263fadb28c8ef498e7da508eb01c72232111faf6df5fc26ea27805c7addd3412bed6f8c79b049b611e89fb19f64e84915c765192868a26bc754bff15ad3d80e745ccfdd307a2c23c384b266e51d1b516dfdccf7e572a3454fbad718';

  const method = data.substring(0, 10);

  if (method !== '0xc9807539') {
    console.log('Wrong method');
    return 'Wrong method';
  }

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    0: _report,
    1: _rs,
    2: _ss,
    3: _rawVs,
  } = provider.eth.abi.decodeParameters(
    // ['bytes32', 'bytes32', 'int192[]'],
    ['bytes', 'bytes32[]', 'bytes32[]', 'bytes32'],
    data.slice(10),
  );
  console.log(_report);

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    0: rawReportContext,
    1: rawObservers,
    2: observations,
  } = provider.eth.abi.decodeParameters(
    ['bytes32', 'bytes32', 'int192[]'],
    _report,
  );
  console.log(observations);
  console.log(observations[parseInt(observations.length / 2)]);
}

function testDecode() {
  const data =
    '0x761057c00000000000000000000000003d9819210a31b4961b30ef54be2aed79b9c9cd3b0000000000000000000000004ddc2d193948926d02f9b1fe9e1daa0718270ed50000000000000000000000005c1ca5a34111c6f55c0778d149ebcc3c19264f7c000000000000000000000000f650c3d88d12db855b8bf7d11be6c55a4e07dcc900000000000000000000000070e36f6bf80a52b3b46b3af8e106cc0ed743e8e4';

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    0: compTroller,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    1: ethAddress,
    2: borrower,
    3: repayToken,
    4: seizeToken,
  } = provider.eth.abi.decodeParameters(
    ['address', 'address', 'address', 'address', 'address'],
    data.slice(10),
  );
  console.log('compTroller:' + compTroller);
  console.log('borrower:' + borrower);
  console.log('repayToken:' + repayToken);
  console.log('seizeToken:' + seizeToken);
}

async function getRPC() {
  provider.eth
    .getNodeInfo()
    .then((str) => console.log('Web3 websocket provider connected:  ' + str));

  provider.currentProvider.send(
    {
      method: 'txpool_content',
      params: [],
      jsonrpc: '2.0',
      id: new Date().getTime(),
    },
    (ress, ww) => {
      console.log('ress: ' + ress);
      console.log('ww: ' + JSON.stringify(ww));
    },
  );
}

function getAllLiquidations(fromBlock) {
  let liquidations = {};
  const input = [
    {
      name: 'liquidator',
      type: 'address',
    },
    {
      name: 'borrower',
      type: 'address',
    },
    {
      name: 'repayAmount',
      type: 'uint256',
    },
    {
      name: 'cTokenCollateral',
      type: 'address',
    },
    {
      name: 'seizeTokens',
      type: 'uint256',
    },
  ];
  const options = {
    address: cTokens
      .map((token) => token.address)
      .concat(ibTokens.map((token) => token.address)),
    topics: [[liquidationTopic]],
    fromBlock,
  };
  provider.eth.subscribe('logs', options, async (err, tx) => {
    if (err) {
      console.log(err);
      return;
    }

    try {
      const decoded = provider.eth.abi.decodeLog(input, tx.data, tx.topics);

      const cSymbol = cTokens.filter(
        (token) => token.address === tx.address.toLowerCase(),
      );
      const ibSymbol = ibTokens.filter((token) => token.address === tx.address);
      const symbol =
        (cSymbol.length > 0 && cSymbol[0].symbol) ||
        (ibSymbol.length > 0 && ibSymbol[0].symbol);

      if (!liquidations[symbol]) {
        liquidations[symbol] = [];
      }
      liquidations[symbol].push({
        blockNumber: tx.blockNumber,
        txHash: tx.transactionHash,
        liquidator: decoded.liquidator,
        repayAmount: decoded.repayAmount,
        seizeTokens: decoded.seizeTokens,
        cTokenCollateral: decoded.cTokenCollateral,
      });
    } catch (err) {
      console.log('Err: ' + err);
    }
  });
  setTimeout(() => {
    console.log(liquidations);
    Object.keys(liquidations).forEach((key) => {
      console.log(key + ' ' + liquidations[key].length);
    });
  }, 4000);
}

// getAllLiquidations(15772592);
// getRPC();
testDecode2();
