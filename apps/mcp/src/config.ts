import { z } from "zod";

const environmentSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  MCP_ALLOWED_HOST: z.string().optional(),
  MCP_MAX_CONCURRENT_REQUESTS: z.coerce.number().int().min(1).max(100).default(12),
  MCP_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(60),
  PORT: z.coerce.number().int().min(0).max(65535).default(3002),
  STABLEFLOW_API_URL: z.url().default("http://127.0.0.1:3001/v1"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
});

export interface McpConfig {
  allowedHost?: string;
  apiUrl: URL;
  host: string;
  maxConcurrentRequests: number;
  port: number;
  rateLimitPerMinute: number;
  trustProxyHops: number;
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): McpConfig {
  const parsed = environmentSchema.parse(environment);
  const apiUrl = new URL(parsed.STABLEFLOW_API_URL);

  if (!(["http:", "https:"].includes(apiUrl.protocol) && apiUrl.pathname.endsWith("/v1"))) {
    throw new Error("STABLEFLOW_API_URL must be an HTTP(S) URL ending in /v1");
  }

  if (parsed.HOST === "0.0.0.0" && !parsed.MCP_ALLOWED_HOST) {
    throw new Error("MCP_ALLOWED_HOST is required when binding to all interfaces");
  }

  if (parsed.MCP_ALLOWED_HOST && !/^[a-z\d.-]+$/i.test(parsed.MCP_ALLOWED_HOST)) {
    throw new Error("MCP_ALLOWED_HOST must be a hostname without a scheme or port");
  }

  return {
    allowedHost: parsed.MCP_ALLOWED_HOST,
    apiUrl,
    host: parsed.HOST,
    maxConcurrentRequests: parsed.MCP_MAX_CONCURRENT_REQUESTS,
    port: parsed.PORT,
    rateLimitPerMinute: parsed.MCP_RATE_LIMIT_PER_MINUTE,
    trustProxyHops: parsed.TRUST_PROXY_HOPS,
  };
}
