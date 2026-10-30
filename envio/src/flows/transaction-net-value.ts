/**
 * Tracks how much USDC a transaction really moves, counting each unit once.
 *
 * A routed swap such as A → router → B emits two Transfer events, but only one amount changes
 * owners. The transaction's net value is the sum of every address's positive net change
 * (router: 0, B: +amount). Ponder processes a transaction's logs contiguously and in order, so
 * per-address nets only need to be kept for the transaction currently being indexed.
 */
export class TransactionNetValueTracker {
  private transactionHash: string | null = null;
  private readonly netByAddress = new Map<string, bigint>();

  /** Returns how much this transfer changes its transaction's net value (may be negative). */
  add({
    from,
    to,
    transactionHash,
    value,
  }: {
    from: string;
    to: string;
    transactionHash: string;
    value: bigint;
  }): bigint {
    if (transactionHash !== this.transactionHash) {
      this.transactionHash = transactionHash;
      this.netByAddress.clear();
    }

    const fromKey = from.toLowerCase();
    const toKey = to.toLowerCase();
    if (fromKey === toKey) return 0n;

    const fromNet = this.netByAddress.get(fromKey) ?? 0n;
    const toNet = this.netByAddress.get(toKey) ?? 0n;
    this.netByAddress.set(fromKey, fromNet - value);
    this.netByAddress.set(toKey, toNet + value);

    return (
      positive(fromNet - value) - positive(fromNet) + positive(toNet + value) - positive(toNet)
    );
  }
}

const positive = (value: bigint) => (value > 0n ? value : 0n);
