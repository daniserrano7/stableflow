import { formatUnits } from "viem";

export type CheckStatus = "FAIL" | "PASS" | "WARN";

export type InspectionCheck = {
  details: string;
  name: string;
  status: CheckStatus;
};

export const formatInteger = (value: bigint) => value.toLocaleString("en-US");

export const formatUsdc = (value: bigint) => `${formatUnits(value, 6)} USDC`;

export const formatPercent = (part: bigint, total: bigint) => {
  if (total === 0n) {
    return "0.00%";
  }

  const basisPoints = (part * 10_000n) / total;
  const integerPart = basisPoints / 100n;
  const decimalPart = (basisPoints % 100n).toString().padStart(2, "0");

  return `${integerPart.toString()}.${decimalPart}%`;
};

export const printJson = (value: unknown) => {
  console.log(
    JSON.stringify(
      value,
      (_key, nestedValue) =>
        typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
      2,
    ),
  );
};

export const getOverallStatus = (checks: InspectionCheck[]): CheckStatus => {
  if (checks.some((check) => check.status === "FAIL")) {
    return "FAIL";
  }

  if (checks.some((check) => check.status === "WARN")) {
    return "WARN";
  }

  return "PASS";
};

export const renderChecks = (checks: InspectionCheck[]) => {
  for (const check of checks) {
    console.log(`${check.status.padEnd(4)} ${check.name}: ${check.details}`);
  }
};
