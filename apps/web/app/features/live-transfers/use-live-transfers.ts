import type { LiveTransferBatchEvent, LiveTransferRow } from "@stableflow/shared";
import { useEffect, useRef, useState } from "react";
import {
  getLatestTransferCursor,
  getNewestTransferCursor,
  mergeTransfers,
} from "./live-transfers.cursor";
import { type TransferFilter, transferMatchesFilter } from "./live-transfers.utils";

const defaultMaxBufferedLiveTransferRows = 250;
const liveTransferFreshDurationMs = 500;
const heartbeatTimeoutMs = 45_000;
const heartbeatCheckIntervalMs = 5_000;

export type LiveTransferConnectionStatus = "connecting" | "live" | "reconnecting";

export const liveTransferConnectionLabels: Record<LiveTransferConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Connected",
  reconnecting: "Reconnecting…",
};

export function useLiveTransfers({
  enabled = true,
  filter = "all",
  initialTransfers,
  maxBufferedRows = defaultMaxBufferedLiveTransferRows,
}: {
  enabled?: boolean;
  filter?: TransferFilter;
  initialTransfers: LiveTransferRow[];
  maxBufferedRows?: number;
}) {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [freshTransferIds, setFreshTransferIds] = useState<ReadonlySet<string>>(() => new Set());
  const [connectionStatus, setConnectionStatus] =
    useState<LiveTransferConnectionStatus>("connecting");
  const transferIdsRef = useRef(getTransferIds(initialTransfers));
  const transfersRef = useRef(initialTransfers);

  useEffect(() => {
    let latestCursor = getLatestTransferCursor(initialTransfers);
    let lastSignalAt = Date.now();
    let events: EventSource | null = null;
    const freshTransferTimeouts = new Set<number>();

    transfersRef.current = initialTransfers;
    transferIdsRef.current = getTransferIds(initialTransfers);
    setFreshTransferIds(new Set());
    setTransfers(initialTransfers);
    setConnectionStatus("connecting");

    if (!enabled) return;

    const onTransfers = (event: MessageEvent) => {
      const batch = JSON.parse(event.data) as LiveTransferBatchEvent;
      lastSignalAt = Date.now();
      setConnectionStatus("live");
      latestCursor = getNewestTransferCursor(latestCursor, batch.cursor);

      const batchTransfers = batch.transfers.filter((transfer) =>
        transferMatchesFilter(transfer, filter),
      );
      const nextFreshTransferIds = batchTransfers
        .filter((transfer) => !transferIdsRef.current.has(transfer.id))
        .map((transfer) => transfer.id);

      const nextTransfers = mergeTransfers(transfersRef.current, batchTransfers).slice(
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
    };

    const openStream = () => {
      events?.close();
      const streamUrl = new URL("/events/transfers", window.location.origin);
      if (latestCursor !== null) {
        streamUrl.searchParams.set("afterBlockNumber", latestCursor.blockNumber);
        streamUrl.searchParams.set("afterLogIndex", latestCursor.logIndex.toString());
      }

      lastSignalAt = Date.now();
      events = new EventSource(streamUrl);
      events.addEventListener("open", () => {
        lastSignalAt = Date.now();
        setConnectionStatus("live");
      });
      events.addEventListener("error", () => setConnectionStatus("reconnecting"));
      events.addEventListener("heartbeat", () => {
        lastSignalAt = Date.now();
        setConnectionStatus("live");
      });
      events.addEventListener("transfers", onTransfers);
    };

    openStream();
    const heartbeatCheck = window.setInterval(() => {
      if (Date.now() - lastSignalAt < heartbeatTimeoutMs) return;
      setConnectionStatus("reconnecting");
      openStream();
    }, heartbeatCheckIntervalMs);

    return () => {
      events?.close();
      window.clearInterval(heartbeatCheck);

      for (const timeout of freshTransferTimeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [enabled, filter, initialTransfers, maxBufferedRows]);

  return {
    connectionStatus,
    freshTransferIds,
    transfers,
  };
}

const getTransferIds = (transfers: LiveTransferRow[]) =>
  new Set(transfers.map((transfer) => transfer.id));
