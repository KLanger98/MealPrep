import { createRequestHandler } from "react-router";
import { handleLogin, requireSession } from "../app/lib/auth";
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

    // Single-user password gate (replaces Cloudflare Access). Off when the
    // APP_PASSWORD secret isn't set, e.g. in local dev and tests.
    if (env.APP_PASSWORD) {
      if (url.pathname === "/login" && request.method === "POST") {
        return handleLogin(request, env.APP_PASSWORD);
      }

      const gate = await requireSession(request, env.APP_PASSWORD);
      if (gate) return gate;
    }

    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
