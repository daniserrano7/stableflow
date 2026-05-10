import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3001),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedIssues = parsedEnv.error.issues.map((issue) => {
    const path = issue.path.join(".") || "unknown";
    const received = "received" in issue ? String(issue.received) : "undefined";
    return `- ${path}: ${issue.message} (received: ${received})`;
  });

  console.error(`Invalid API environment variables:\n${formattedIssues.join("\n")}`);

  throw new Error("Invalid API environment variables");
}

export const env = parsedEnv.data;
