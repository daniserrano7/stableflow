import { z } from "zod";

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  // Schema holding the indexer tables; the Ponder views schema in production.
  DATABASE_SCHEMA: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]{0,44}$/, "Must be a valid Postgres schema name")
    .default("public"),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type ApiEnvironment = z.infer<typeof apiEnvSchema>;

const formatApiEnvIssues = (error: z.ZodError): string => {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "unknown";
      const received = "received" in issue ? String(issue.received) : "undefined";
      return `- ${path}: ${issue.message} (received: ${received})`;
    })
    .join("\n");
};

export const validateApiEnv = (config: Record<string, unknown>): ApiEnvironment => {
  const parsedEnv = apiEnvSchema.safeParse(config);

  if (!parsedEnv.success) {
    throw new Error(`Invalid API environment variables:\n${formatApiEnvIssues(parsedEnv.error)}`);
  }

  return parsedEnv.data;
};
