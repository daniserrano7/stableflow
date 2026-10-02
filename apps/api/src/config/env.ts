import { z } from "zod";

const schemaName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,44}$/, "Must be a valid Postgres schema name");

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  // Schema holding the indexer tables; the archive in production.
  DATABASE_SCHEMA: schemaName.default("public"),
  // The live indexer tables, for the transfer stream; the Ponder views in production.
  // Defaults to DATABASE_SCHEMA.
  DATABASE_LIVE_SCHEMA: schemaName.optional(),
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
