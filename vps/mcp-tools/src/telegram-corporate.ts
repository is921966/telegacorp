/**
 * MCP Server — Telegram Corporate Bridge
 *
 * Provides MCP tools for OpenClaw agents to interact with the corporate
 * Telegram ecosystem through the Vercel Service API.
 *
 * Tools:
 * - send_corporate_message: Send a message to a corporate chat
 * - get_chat_history: Retrieve message history from archive
 * - get_patterns: List detected automation patterns
 * - search_archive: Full-text search across message archive
 * - submit_feedback: Record feedback on agent performance
 * - get_monitored_chats: List chats with AI monitoring enabled
 */

import express from "express";

const PORT = parseInt(process.env.PORT ?? "3100", 10);
const VERCEL_API_URL = process.env.VERCEL_API_URL ?? "";
const SERVICE_TOKEN = process.env.SERVICE_API_TOKEN ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// ---- HTTP helpers ----

async function serviceCall(
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${VERCEL_API_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${SERVICE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Service API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function supabaseQuery(
  table: string,
  params: URLSearchParams
): Promise<unknown> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---- Tool definitions ----

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const tools: ToolDef[] = [
  {
    name: "send_corporate_message",
    description:
      "Send a message to a corporate Telegram chat via the admin bot",
    inputSchema: {
      type: "object",
      properties: {
        chat_id: { type: "number", description: "Target chat ID" },
        text: { type: "string", description: "Message text to send" },
        reply_to_msg_id: {
          type: "number",
          description: "Optional message ID to reply to",
        },
      },
      required: ["chat_id", "text"],
    },
    handler: async (args) => {
      return serviceCall("/api/service/messages/send", "POST", {
        chat_id: args.chat_id,
        text: args.text,
        reply_to_msg_id: args.reply_to_msg_id,
      });
    },
  },
  {
    name: "get_chat_history",
    description:
      "Retrieve message history from the corporate archive for a specific chat",
    inputSchema: {
      type: "object",
      properties: {
        chat_id: { type: "number", description: "Chat ID to get history for" },
        limit: {
          type: "number",
          description: "Max messages to return (default: 50)",
        },
      },
      required: ["chat_id"],
    },
    handler: async (args) => {
      const limit = (args.limit as number) ?? 50;
      return serviceCall(
        `/api/service/chats/${args.chat_id}/history?limit=${limit}`
      );
    },
  },
  {
    name: "get_patterns",
    description:
      "List detected automation patterns, optionally filtered by status",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["new", "proposed", "approved", "automated", "rejected"],
          description: "Filter by pattern status",
        },
      },
    },
    handler: async (args) => {
      const params = new URLSearchParams();
      params.set("select", "*");
      params.set("order", "detected_at.desc");
      if (args.status) {
        params.set("status", `eq.${args.status}`);
      }
      return supabaseQuery("automation_patterns", params);
    },
  },
  {
    name: "search_archive",
    description: "Full-text search across the corporate message archive",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query text" },
        chat_id: {
          type: "number",
          description: "Optional: restrict to specific chat",
        },
        limit: { type: "number", description: "Max results (default: 20)" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const params = new URLSearchParams();
      params.set("select", "chat_id,message_id,sender_name,text,date");
      params.set(
        "text",
        `fts.${(args.query as string).replace(/\s+/g, "+")}`
      );
      params.set("order", "date.desc");
      params.set("limit", String((args.limit as number) ?? 20));

      if (args.chat_id) {
        params.set("chat_id", `eq.${args.chat_id}`);
      }

      return supabaseQuery("message_archive", params);
    },
  },
  {
    name: "submit_feedback",
    description: "Record user feedback on an agent action",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "Agent UUID" },
        type: {
          type: "string",
          enum: ["thumbs_up", "thumbs_down", "correction", "comment"],
          description: "Feedback type",
        },
        message: {
          type: "string",
          description: "Optional feedback message",
        },
        original_output: {
          type: "string",
          description: "The agent output being rated",
        },
        corrected_output: {
          type: "string",
          description: "The correct output (for corrections)",
        },
      },
      required: ["agent_id", "type"],
    },
    handler: async (args) => {
      const body = {
        agent_id: args.agent_id,
        type: args.type,
        message: args.message ?? null,
        original_output: args.original_output ?? null,
        corrected_output: args.corrected_output ?? null,
      };

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/agent_feedback`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to submit feedback: ${res.status}`);
      }
      return res.json();
    },
  },
  {
    name: "get_monitored_chats",
    description: "List all chats with AI monitoring enabled",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      return serviceCall("/api/service/chats/monitored");
    },
  },
];

// ---- MCP-compatible HTTP server ----
// Exposes tools via a simple JSON-RPC-like HTTP API
// OpenClaw can consume this as an MCP stdio or HTTP tool server

const app = express();
app.use(express.json());

/** List all available tools */
app.get("/tools", (_req, res) => {
  res.json({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });
});

/** Execute a tool */
app.post("/tools/:name", async (req, res) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) {
    res.status(404).json({ error: `Tool not found: ${req.params.name}` });
    return;
  }

  try {
    const result = await tool.handler(req.body ?? {});
    res.json({ result });
  } catch (err) {
    console.error(`[MCP] Tool ${req.params.name} error:`, err);
    res.status(500).json({
      error: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

/** Health check */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", tools: tools.length });
});

app.listen(PORT, () => {
  console.log(`=== MCP Telegram Corporate Server ===`);
  console.log(`Listening on port ${PORT}`);
  console.log(`Tools: ${tools.map((t) => t.name).join(", ")}`);
  console.log(`Vercel API: ${VERCEL_API_URL || "(not configured)"}`);
});
