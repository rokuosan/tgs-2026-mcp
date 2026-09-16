import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { createServer } from "./server";

declare module "hono" {
  interface ContextVariableMap {
    parsedBody: unknown;
  }
}

const app = createMcpHonoApp({ host: "0.0.0.0" });
const handleMcp = createMcpHandler(createServer, {
  onerror: (error) =>
    console.error(JSON.stringify({ message: "MCP request failed", error: error.message })),
});

app.get("/", (context) =>
  context.json({ name: "tgs-2026-mcp", version: "0.1.0", endpoint: "/mcp" }),
);
app.all("/mcp", (context) =>
  handleMcp.fetch(context.req.raw, { parsedBody: context.var.parsedBody }),
);

export default app;
