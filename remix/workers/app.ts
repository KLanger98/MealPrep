import { createRequestHandler } from "react-router";
import { RecipeMcp } from "./recipe-mcp";

// Durable Object classes must be exported from the worker entry module.
export { RecipeMcp };

// The real endpoint is /mcp/<MCP_SECRET>; the secret is checked here and the
// URL rewritten to the static path McpAgent.serve() expects.
const mcpHandler = RecipeMcp.serve("/mcp", { binding: "RECIPE_MCP" });

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      if (!env.MCP_SECRET || url.pathname !== `/mcp/${env.MCP_SECRET}`) {
        return new Response("Not found", { status: 404 });
      }

      const rewritten = new Request(
        new URL(`/mcp${url.search}`, url.origin),
        request,
      );
      return mcpHandler.fetch(rewritten, env, ctx);
    }

    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
