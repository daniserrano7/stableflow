/**
 * A readable error description for logs. Connection failures can be an AggregateError
 * with an empty message (one inner error per address tried).
 */
export const describeError = (error: unknown): string => {
  if (error instanceof AggregateError) {
    return error.errors.map(describeError).join("; ") || "AggregateError";
  }
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return [code, error.message].filter(Boolean).join(": ") || error.name;
  }
  return String(error);
};
