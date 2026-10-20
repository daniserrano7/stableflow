export type TransferFilter = "all" | "large" | "whale";

export const transferThresholds = { all: 0, large: 10_000, whale: 1_000_000 } as const;
export const transfersPageSize = 50;

export interface TransferListParams {
  filter: TransferFilter;
  cursor: { blockNumber: string; logIndex: number } | null;
  direction: "older" | "newer";
  limit?: number;
}

export function parseTransferListParams(params: URLSearchParams): TransferListParams {
  const filter = params.get("filter") ?? "all";
  const direction = params.get("direction") ?? "older";
  const cursor = params.get("cursor");
  const limitParam = params.get("limit");
  if (
    limitParam !== null &&
    (!/^\d+$/.test(limitParam) || Number(limitParam) < 1 || Number(limitParam) > transfersPageSize)
  ) {
    throw new Error(`Limit must be between 1 and ${transfersPageSize}.`);
  }
  const limit = limitParam === null ? {} : { limit: Number(limitParam) };
  if (!(filter === "all" || filter === "large" || filter === "whale")) {
    throw new Error("Filter must be all, large, or whale.");
  }
  if (direction !== "older" && direction !== "newer") {
    throw new Error("Direction must be older or newer.");
  }
  if (cursor === null) {
    if (direction === "newer") throw new Error("A cursor is required for newer transfers.");
    return { filter, direction, cursor: null, ...limit };
  }
  if (!/^\d{1,20}:\d{1,10}$/.test(cursor)) throw new Error("Invalid transfer cursor.");
  const [blockNumber, logIndex] = cursor.split(":") as [string, string];
  if (BigInt(blockNumber) > 9_223_372_036_854_775_807n || Number(logIndex) > 2_147_483_647) {
    throw new Error("Transfer cursor is out of range.");
  }
  return { filter, direction, cursor: { blockNumber, logIndex: Number(logIndex) }, ...limit };
}

// Transfer IDs are the indexer's primary key: `${transactionHash}-${logIndex}`.
const transferIdPattern = /^(0x[0-9a-f]{64})-(\d{1,10})$/;

export function parseTransferId(
  value: string,
): { id: string; transactionHash: string; logIndex: number } | null {
  const id = value.toLowerCase();
  const match = transferIdPattern.exec(id);
  if (match === null) return null;
  const logIndex = Number(match[2]);
  if (logIndex > 2_147_483_647) return null;
  return { id: `${match[1]}-${logIndex}`, transactionHash: match[1] as string, logIndex };
}
