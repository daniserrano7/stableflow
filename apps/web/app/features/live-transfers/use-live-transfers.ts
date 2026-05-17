import type { LiveTransferBatchEvent, LiveTransferRow } from "@stableflow/shared";
import { useEffect, useRef, useState } from "react";
import {
  getLatestTransferCursor,
  getNewestTransferCursor,
  mergeTransfers,
} from "./live-transfers.cursor";

const defaultMaxBufferedLiveTransferRows = 250;
const liveTransferFreshDurationMs = 500;

export function useLiveTransfers({
  initialTransfers,
  maxBufferedRows = defaultMaxBufferedLiveTransferRows,
}: {
  initialTransfers: LiveTransferRow[];
  maxBufferedRows?: number;
}) {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [freshTransferIds, setFreshTransferIds] = useState<ReadonlySet<string>>(() => new Set());
  const transferIdsRef = useRef(getTransferIds(initialTransfers));
  const transfersRef = useRef(initialTransfers);

  useEffect(() => {
    let latestCursor = getLatestTransferCursor(initialTransfers);
    const freshTransferTimeouts = new Set<number>();
    const streamUrl = new URL("/events/transfers", window.location.origin);

    transfersRef.current = initialTransfers;
    transferIdsRef.current = getTransferIds(initialTransfers);
    setFreshTransferIds(new Set());
    setTransfers(initialTransfers);

    if (latestCursor !== null) {
      streamUrl.searchParams.set("afterBlockNumber", latestCursor.blockNumber);
      streamUrl.searchParams.set("afterLogIndex", latestCursor.logIndex.toString());
    }

    const events = new EventSource(streamUrl);

    events.addEventListener("transfers", (event) => {
      const batch = JSON.parse(event.data) as LiveTransferBatchEvent;
      const nextFreshTransferIds = batch.transfers
        .filter((transfer) => !transferIdsRef.current.has(transfer.id))
        .map((transfer) => transfer.id);

      latestCursor = getNewestTransferCursor(latestCursor, batch.cursor);

      const nextTransfers = mergeTransfers(transfersRef.current, batch.transfers).slice(
        0,
        maxBufferedRows,
      );

      transfersRef.current = nextTransfers;
      transferIdsRef.current = getTransferIds(nextTransfers);

      if (nextFreshTransferIds.length > 0) {
        setFreshTransferIds(
          (currentFreshIds) => new Set([...currentFreshIds, ...nextFreshTransferIds]),
        );

        const timeout = window.setTimeout(() => {
          freshTransferTimeouts.delete(timeout);
          setFreshTransferIds((currentFreshIds) => {
            const nextFreshIds = new Set(currentFreshIds);

            for (const transferId of nextFreshTransferIds) {
              nextFreshIds.delete(transferId);
            }

            return nextFreshIds;
          });
        }, liveTransferFreshDurationMs);

        freshTransferTimeouts.add(timeout);
      }

      setTransfers(nextTransfers);
    });

    return () => {
      events.close();

      for (const timeout of freshTransferTimeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [initialTransfers, maxBufferedRows]);

  return {
    freshTransferIds,
    transfers,
  };
}

const getTransferIds = (transfers: LiveTransferRow[]) =>
  new Set(transfers.map((transfer) => transfer.id));
