/** Public URL of the MCP server, or null when this deployment doesn't advertise one. */
export const getMcpPublicUrl = () =>
  process.env.STABLEFLOW_MCP_PUBLIC_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3002/mcp" : null);
