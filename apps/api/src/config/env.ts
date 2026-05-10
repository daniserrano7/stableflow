import { z } from "zod";

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
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
