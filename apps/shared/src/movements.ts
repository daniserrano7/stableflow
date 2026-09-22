export type MovementFilter = "all" | "large" | "whale";

export const movementThresholds = { all: 0, large: 10_000, whale: 1_000_000 } as const;
export const movementsPageSize = 50;

export interface MovementParams {
  filter: MovementFilter;
  cursor: { blockNumber: string; logIndex: number } | null;
  direction: "older" | "newer";
}

export function parseMovementParams(params: URLSearchParams): MovementParams {
  const filter = params.get("filter") ?? "all";
  const direction = params.get("direction") ?? "older";
  const cursor = params.get("cursor");
  if (!(filter === "all" || filter === "large" || filter === "whale")) {
    throw new Error("Filter must be all, large, or whale.");
  }
  if (direction !== "older" && direction !== "newer") {
    throw new Error("Direction must be older or newer.");
  }
  if (cursor === null) {
    if (direction === "newer") throw new Error("A cursor is required for newer movements.");
    return { filter, direction, cursor: null };
  }
  if (!/^\d{1,20}:\d{1,10}$/.test(cursor)) throw new Error("Invalid movement cursor.");
  const [blockNumber, logIndex] = cursor.split(":") as [string, string];
  if (BigInt(blockNumber) > 9_223_372_036_854_775_807n || Number(logIndex) > 2_147_483_647) {
    throw new Error("Movement cursor is out of range.");
  }
  return { filter, direction, cursor: { blockNumber, logIndex: Number(logIndex) } };
}
