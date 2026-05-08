import { env } from "../env/env.js";

export const baseRpcUrl = env.PONDER_RPC_URL_8453;

export const baseUsdc = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
  symbol: "USDC",
} as const;
