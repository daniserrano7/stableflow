import { z } from "zod";

const schemaName = z
  .string()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]{0,44}$/,
    "Must be a valid Postgres schema name up to 45 characters",
  )
  .refine((value) => value !== "ponder_sync", "Schema name is reserved by Ponder");

const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    DATABASE_SCHEMA: schemaName.default("public"),
    // Read by `ponder start` to publish views of the live deployment's tables.
    DATABASE_VIEWS_SCHEMA: schemaName.optional(),
    PONDER_DISCOVERY_START_BLOCK_8453: z
      .string()
      .regex(/^\d+$/, "Must be a positive integer block number")
      .transform(Number)
      .refine(Number.isSafeInteger, "Must be a safe integer block number")
      .optional(),
    PONDER_RPC_URL_8453: z.string().url(),
    // Production: skip Ponder's RPC cache. Deployments only backfill a few minutes.
    PONDER_DISABLE_CACHE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    // Production: the archive keeps history, so a deployment only keeps recent rows.
    LIVE_RETENTION_HOURS: z.coerce.number().positive().optional(),
  })
  .superRefine((value, context) => {
    // Each views-pattern deployment indexes into a fresh schema. Starting at
    // "latest" would silently drop the history the previous deployment served.
    if (
      value.DATABASE_VIEWS_SCHEMA !== undefined &&
      value.PONDER_DISCOVERY_START_BLOCK_8453 === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Required when DATABASE_VIEWS_SCHEMA is set",
        path: ["PONDER_DISCOVERY_START_BLOCK_8453"],
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedIssues = parsedEnv.error.issues.map((issue) => {
    const path = issue.path.join(".") || "unknown";
    const received = "received" in issue ? String(issue.received) : "undefined";
    return `- ${path}: ${issue.message} (received: ${received})`;
  });

  console.error(`Invalid indexer environment variables:\n${formattedIssues.join("\n")}`);

  throw new Error("Invalid indexer environment variables");
}

export const env = parsedEnv.data;
