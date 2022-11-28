export const disabled = process.env.IRONBANK_DISABLE_TXS === 'true';

export const addresses = {
  compTroller: '0xAB1c342C7bf5Ec5F02ADEA1c2270670bCa144CbB',
  eth: '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393',
};

export const revertMsgWaitFor = {
  'cannot send value to fallback': 'Mint',
  'insufficient cash': 'Mint',
};

export const checkRevertMsgWaitFor = (
  msg: Record<string, any>,
  candidate: Record<string, any>,
) => {
  switch (msg.revertMsgWaitFor) {
    case 'Mint':
      if (
        msg.watchedAddress === candidate.repayToken ||
        msg.watchedAddress === candidate.seizeToken
      ) {
        return true;
      }
    default:
      return false;
  }
};
