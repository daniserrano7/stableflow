import { isFlowBoundaryLabel } from "../labels/base-address-labels";
import type { FlowLabel } from "./labels";

export type FlowDirection = "in" | "out";

export const unidentifiedLabel = {
  attributionGroup: "unidentified",
  category: "unidentified",
  countingPolicy: "boundary",
  entityId: "unidentified",
  entityName: "Unidentified",
} as const;

export const getEntityFlowUpdates = ({
  fromLabel,
  toLabel,
}: {
  fromLabel: FlowLabel | undefined;
  toLabel: FlowLabel | undefined;
}) => {
  if (
    fromLabel !== undefined &&
    toLabel !== undefined &&
    fromLabel.attributionGroup === toLabel.attributionGroup
  ) {
    return [];
  }

  const updates: { direction: FlowDirection; label: FlowLabel }[] = [];
  const fromFlowLabel = isFlowBoundaryLabel(fromLabel) ? fromLabel : undefined;
  const toFlowLabel = isFlowBoundaryLabel(toLabel) ? toLabel : undefined;

  if (fromFlowLabel === undefined && toFlowLabel === undefined) {
    updates.push({ direction: "out", label: unidentifiedLabel });
    updates.push({ direction: "in", label: unidentifiedLabel });
    return updates;
  }

  if (fromFlowLabel !== undefined) {
    updates.push({ direction: "out", label: fromFlowLabel });
  } else if (toFlowLabel !== undefined) {
    updates.push({ direction: "out", label: unidentifiedLabel });
  }

  if (toFlowLabel !== undefined) {
    updates.push({ direction: "in", label: toFlowLabel });
  } else if (fromFlowLabel !== undefined) {
    updates.push({ direction: "in", label: unidentifiedLabel });
  }

  return updates;
};

export const getEntityPairFlowUpdate = ({
  fromLabel,
  toLabel,
}: {
  fromLabel: FlowLabel | undefined;
  toLabel: FlowLabel | undefined;
}): { fromLabel: FlowLabel; toLabel: FlowLabel } | undefined => {
  if (
    fromLabel !== undefined &&
    toLabel !== undefined &&
    fromLabel.attributionGroup === toLabel.attributionGroup
  ) {
    return undefined;
  }

  let fromFlowLabel: FlowLabel = unidentifiedLabel;
  let toFlowLabel: FlowLabel = unidentifiedLabel;

  if (fromLabel !== undefined && isFlowBoundaryLabel(fromLabel)) fromFlowLabel = fromLabel;
  if (toLabel !== undefined && isFlowBoundaryLabel(toLabel)) toFlowLabel = toLabel;

  return { fromLabel: fromFlowLabel, toLabel: toFlowLabel };
};
