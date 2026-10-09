import type { LiveTransferRow } from "@stableflow/shared";
import { useEffect, useRef, useState } from "react";
import type { FlowParticle } from "./flow-graph.types";

const maxParticles = 80;
const particleStaggerMs = 140;

/**
 * Turns freshly arrived transfers into particles travelling along the graph's edges. Each
 * transfer launches once, and several landing on one route in the same batch are spaced out along
 * it. `getEdgeId` is an effect dependency, so pass a function defined at module scope.
 */
export function useFlowParticles({
  edgeIds,
  freshTransferIds,
  getEdgeId,
  transfers,
}: {
  edgeIds: ReadonlySet<string>;
  freshTransferIds: ReadonlySet<string>;
  getEdgeId: (transfer: LiveTransferRow) => string | null;
  transfers: LiveTransferRow[];
}) {
  const [particles, setParticles] = useState<FlowParticle[]>([]);
  const seenTransferIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const retainedTransferIds = new Set(transfers.map((transfer) => transfer.id));

    for (const transferId of seenTransferIdsRef.current) {
      if (!retainedTransferIds.has(transferId)) {
        seenTransferIdsRef.current.delete(transferId);
      }
    }

    const now = performance.now();
    const queuedByEdgeId = new Map<string, number>();
    const nextParticles: FlowParticle[] = [];

    for (const transfer of transfers) {
      if (!freshTransferIds.has(transfer.id) || seenTransferIdsRef.current.has(transfer.id)) {
        continue;
      }

      seenTransferIdsRef.current.add(transfer.id);

      const edgeId = getEdgeId(transfer);

      if (edgeId === null || !edgeIds.has(edgeId)) {
        continue;
      }

      const queued = queuedByEdgeId.get(edgeId) ?? 0;

      queuedByEdgeId.set(edgeId, queued + 1);
      nextParticles.push({
        amount: getTransferAmount(transfer),
        durationMs: 1_300 + hashToUnit(transfer.id) * 600,
        edgeId,
        id: transfer.id,
        startedAt: now + queued * particleStaggerMs,
      });
    }

    if (nextParticles.length > 0) {
      setParticles((currentParticles) =>
        [
          ...currentParticles.filter((particle) => isParticleAlive(particle, now)),
          ...nextParticles,
        ].slice(-maxParticles),
      );
    }
  }, [edgeIds, freshTransferIds, getEdgeId, transfers]);

  // Drop each particle as it lands, so the graph stops animating once the route is quiet.
  useEffect(() => {
    if (particles.length === 0) {
      return;
    }

    const now = performance.now();
    const nextExpiry = Math.min(
      ...particles.map((particle) => particle.startedAt + particle.durationMs),
    );
    const timeout = window.setTimeout(
      () => {
        const expiredAt = performance.now();

        setParticles((currentParticles) =>
          currentParticles.filter((particle) => isParticleAlive(particle, expiredAt)),
        );
      },
      Math.max(16, nextExpiry - now + 16),
    );

    return () => window.clearTimeout(timeout);
  }, [particles]);

  return particles;
}

function isParticleAlive(particle: FlowParticle, now: number) {
  return now - particle.startedAt < particle.durationMs;
}

function getTransferAmount(transfer: LiveTransferRow) {
  const amount = Number.parseFloat(transfer.amount.formatted.replaceAll(",", ""));

  return Number.isFinite(amount) ? amount : 0;
}

function hashToUnit(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}
