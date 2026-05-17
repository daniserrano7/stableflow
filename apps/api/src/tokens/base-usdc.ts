import type { StablecoinSymbol } from "@stableflow/shared";
import { type Address, formatUnits } from "viem";

interface StablecoinToken {
  address: Address;
  decimals: number;
  symbol: StablecoinSymbol;
}

interface StablecoinAmount {
  currency: StablecoinSymbol;
  formatted: string;
  raw: string;
}

export const baseUsdc = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
  symbol: "USDC",
} as const satisfies StablecoinToken;

export const toTokenAmount = (
  value: bigint,
  token: StablecoinToken = baseUsdc,
): StablecoinAmount => ({
  currency: token.symbol,
  formatted: formatUnits(value, token.decimals),
  raw: value.toString(),
});
