export const BASE_CHAIN_ID = 8453;

export const baseUsdc = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
  symbol: "USDC",
} as const;

export const baseProtocolContracts = {
  aaveV3Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
} as const;

export const bucketSize = "1m";
export const bucketSizeSeconds = 60n;

export const zeroAddress = "0x0000000000000000000000000000000000000000";
export const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const getBucketStart = (timestamp: bigint) => timestamp - (timestamp % bucketSizeSeconds);

const getPaddedAddress = (address: string) => `0x000000000000000000000000${address.slice(2)}`;

/** Matches a plain address or the same address left-padded to bytes32 (Across v4 events). */
export const isBaseUsdcToken = (token: string) => {
  const normalizedToken = token.toLowerCase();
  const normalizedBaseUsdc = baseUsdc.address.toLowerCase();

  return (
    normalizedToken === normalizedBaseUsdc ||
    normalizedToken === getPaddedAddress(baseUsdc.address).toLowerCase()
  );
};
