import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PONDER_RPC_URL_8453: z.string().url(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedIssues = parsedEnv.error.issues.map((issue) => {
    const path = issue.path.join(".") || "unknown";
    const received = "received" in issue ? String(issue.received) : "undefined";
    return `- ${path}: ${issue.message} (received: ${received})`;
  });

  console.error(
    `Invalid indexer environment variables:\n${formattedIssues.join("\n")}`,
  );

  throw new Error("Invalid indexer environment variables");
}

export const env = parsedEnv.data;
