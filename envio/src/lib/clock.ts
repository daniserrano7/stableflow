let newest: bigint | undefined;

/** Called from the Transfer handler's sequential pass. */
export const recordBlockTimestamp = (timestamp: bigint) => {
  newest = timestamp;
};

export const latestBlockTimestamp = () => newest;
