/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Web3 = require('web3');

const provider = new Web3(process.env.WEB3_HTTP_PROVIDER);

const options = {
  address: '0xc029784F0B3cCEd83c9f98FdB857989b4FB9D1E7',
  fromBlock: 1,
};

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

function testSubscription() {
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

testDecode();
