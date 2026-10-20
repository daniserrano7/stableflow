import { hostHeaderValidation, localhostOriginValidation } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import express, { type NextFunction, type Request, type Response } from "express";
import { ApiClient } from "./api-client.js";
import type { McpConfig } from "./config.js";
import { createStableflowServer } from "./tools.js";

const rateWindowMs = 60_000;
const maxTrackedClients = 10_000;

interface RateWindow {
  count: number;
  resetAt: number;
}

export function createApp(config: McpConfig) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops);

  const client = new ApiClient(config.apiUrl);
  const handler = createMcpHandler(() => createStableflowServer(client));
  const nodeHandler = toNodeHandler(handler);
  const windows = new Map<string, RateWindow>();
  let inFlight = 0;

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(
    "/mcp",
    hostHeaderValidation(
      config.allowedHost
        ? [config.allowedHost, "localhost", "127.0.0.1", "[::1]"]
        : ["localhost", "127.0.0.1", "[::1]"],
    ),
  );
  if (!config.allowedHost) app.use("/mcp", localhostOriginValidation());

  app.use("/mcp", (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const current = windows.get(ip);
    const window =
      current && current.resetAt > now ? current : { count: 0, resetAt: now + rateWindowMs };

    if (window.count >= config.rateLimitPerMinute) {
      response.setHeader("Retry-After", Math.max(1, Math.ceil((window.resetAt - now) / 1000)));
      response.status(429).json({ error: "Rate limit exceeded. Try again shortly." });
      return;
    }

    window.count += 1;
    windows.delete(ip);
    windows.set(ip, window);

    if (windows.size > maxTrackedClients) {
      for (const [key, value] of windows) {
        if (value.resetAt <= now || windows.size > maxTrackedClients) windows.delete(key);
        if (windows.size <= maxTrackedClients) break;
      }
    }

    if (inFlight >= config.maxConcurrentRequests) {
      response.setHeader("Retry-After", "1");
      response.status(503).json({ error: "MCP server is busy. Try again shortly." });
      return;
    }

    inFlight += 1;
    let settled = false;
    const release = () => {
      if (settled) return;
      settled = true;
      inFlight -= 1;
    };
    response.once("finish", release);
    response.once("close", release);
    next();
  });

  app.use("/mcp", express.json({ limit: "16kb" }));

  app.all("/mcp", (request, response) => {
    void nodeHandler(request, response, request.body).catch((error: unknown) => {
      console.error("MCP request failed:", error instanceof Error ? error.message : error);
      if (!response.headersSent) response.status(500).json({ error: "MCP request failed." });
    });
  });

  return { app, close: () => handler.close() };
}
