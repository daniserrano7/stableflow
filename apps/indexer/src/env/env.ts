import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_SCHEMA: z
    .string()
    .regex(
      /^[A-Za-z_][A-Za-z0-9_]{0,44}$/,
      "Must be a valid Postgres schema name up to 45 characters",
    )
    .refine((value) => value !== "ponder_sync", "Schema name is reserved by Ponder")
    .default("public"),
  PONDER_DISCOVERY_START_BLOCK_8453: z
    .string()
    .regex(/^\d+$/, "Must be a positive integer block number")
    .transform(Number)
    .refine(Number.isSafeInteger, "Must be a safe integer block number")
    .optional(),
  PONDER_RPC_URL_8453: z.string().url(),
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
