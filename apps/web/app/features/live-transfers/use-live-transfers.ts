import type { LiveTransferBatchEvent, LiveTransferRow } from "@stableflow/shared";
import { useEffect, useState } from "react";
import {
  getLatestTransferCursor,
  getNewestTransferCursor,
  mergeTransfers,
} from "./live-transfers.cursor";

const defaultMaxBufferedLiveTransferRows = 250;

export function useLiveTransfers({
  initialTransfers,
  maxBufferedRows = defaultMaxBufferedLiveTransferRows,
}: {
  initialTransfers: LiveTransferRow[];
  maxBufferedRows?: number;
}) {
  const [transfers, setTransfers] = useState(initialTransfers);

  useEffect(() => {
    let latestCursor = getLatestTransferCursor(initialTransfers);
    const streamUrl = new URL("/events/transfers", window.location.origin);

    setTransfers(initialTransfers);

    if (latestCursor !== null) {
      streamUrl.searchParams.set("afterBlockNumber", latestCursor.blockNumber);
      streamUrl.searchParams.set("afterLogIndex", latestCursor.logIndex.toString());
    }

    const events = new EventSource(streamUrl);

    events.addEventListener("transfers", (event) => {
      const batch = JSON.parse(event.data) as LiveTransferBatchEvent;

      latestCursor = getNewestTransferCursor(latestCursor, batch.cursor);

      setTransfers((currentTransfers) =>
        mergeTransfers(currentTransfers, batch.transfers).slice(0, maxBufferedRows),
      );
    });

    return () => {
      events.close();
    };
  }, [initialTransfers, maxBufferedRows]);

  return transfers;
}
