import { createServer } from "node:http";
import { readConfig } from "./config.js";
import { createApp } from "./server.js";

const config = readConfig();
const { app, close } = createApp(config);
const server = createServer(app);

server.listen(config.port, config.host, () => {
  console.log(`Stableflow MCP listening on http://${config.host}:${config.port}/mcp`);
});

async function shutdown() {
  server.close();
  await close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
