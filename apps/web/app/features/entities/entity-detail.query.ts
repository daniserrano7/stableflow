import type { EntityDetailResponse } from "@stableflow/shared";
import { appendEntityDetailSearchParams, type EntityDetailWindow } from "./entity-detail.params";

export const entityDetailRefreshIntervalMs = 2_000;

interface EntityDetailQueryOptions {
  entityId: string;
  windowMinutes: EntityDetailWindow;
}

export const entityDetailQueryKey = ({ entityId, windowMinutes }: EntityDetailQueryOptions) =>
  ["entity-detail", { entityId, windowMinutes }] as const;

export const getMatchingInitialEntityDetail = (
  initialDetail: EntityDetailResponse,
  { entityId, windowMinutes }: EntityDetailQueryOptions,
) => {
  if (
    initialDetail.data.entity.entityId === entityId &&
    initialDetail.meta.window.minutes.toString() === windowMinutes
  ) {
    return initialDetail;
  }

  return undefined;
};

export const fetchEntityDetail = async ({
  entityId,
  signal,
  windowMinutes,
}: EntityDetailQueryOptions & {
  signal: AbortSignal;
}) => {
  const url = new URL(`/api/entities/${encodeURIComponent(entityId)}`, window.location.origin);
  appendEntityDetailSearchParams(url, { windowMinutes });

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Unable to load entity detail");
  }

  return response.json() as Promise<EntityDetailResponse>;
};
