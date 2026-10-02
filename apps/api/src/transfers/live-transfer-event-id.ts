import type { LiveTransferCursor } from "@stableflow/shared";

const maxBlockNumber = 9_223_372_036_854_775_807n;
const maxLogIndex = 2_147_483_647;

export const toLiveTransferEventId = (cursor: LiveTransferCursor | null) =>
  cursor === null ? "latest" : `${cursor.blockNumber}:${cursor.logIndex}`;

export const parseLiveTransferEventId = (
  value: string | undefined,
): LiveTransferCursor | null | undefined => {
  if (value === "latest") return null;
  if (value === undefined || !/^\d{1,20}:\d{1,10}$/.test(value)) return undefined;

  const [blockNumber, logIndex] = value.split(":") as [string, string];
  const parsedLogIndex = Number(logIndex);
  if (BigInt(blockNumber) > maxBlockNumber || parsedLogIndex > maxLogIndex) return undefined;

  return { blockNumber, logIndex: parsedLogIndex };
};
