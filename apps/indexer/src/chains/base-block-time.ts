/** Base (OP Stack) produces a block every 200 ms since the Denim upgrade (2 seconds before). */
export const baseBlockMilliseconds = 200;

/** Whole Base blocks produced in `seconds`. No imports, so the archiver can use it too. */
export const baseBlocksIn = (seconds: number) =>
  Math.floor((seconds * 1000) / baseBlockMilliseconds);
