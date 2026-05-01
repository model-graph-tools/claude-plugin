#!/usr/bin/env node

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";
import { closeAll } from "./neo4j.js";
import { listSources } from "./tools/list-sources.js";
import { startSource } from "./tools/start-source.js";
import { stopSource } from "./tools/stop-source.js";
import { searchResources } from "./tools/search-resources.js";
import { browseResource } from "./tools/browse-resource.js";
import { searchOperations } from "./tools/search-operations.js";
import { searchAttributes } from "./tools/search-attributes.js";
import { findCapabilities } from "./tools/find-capabilities.js";
import { findDeprecated } from "./tools/find-deprecated.js";
import { compareVersions } from "./tools/compare-versions.js";
import { runCypher } from "./tools/run-cypher.js";

const server = new McpServer({
  name: "wildfly-model-graph",
  version: "0.2.0",
});

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

// --- Lifecycle tools ---

server.registerTool("list_sources", {
  description:
    "Lists all known WildFly versions and feature packs with their container status (running/stopped/not_found).",
}, async () => {
  try {
    return textResult(await listSources());
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("start_source", {
  description:
    "Starts the Neo4j container for a WildFly version or feature pack. Pulls the image automatically if needed.",
  inputSchema: z.object({
    identifier: z
      .string()
      .describe('Source identifier, e.g. "39", "26.1", "ai-0.9.1"'),
  }),
}, async ({ identifier }) => {
  try {
    return textResult(await startSource(identifier));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("stop_source", {
  description: "Stops the Neo4j container for a WildFly version or feature pack.",
  inputSchema: z.object({
    identifier: z
      .string()
      .describe('Source identifier, e.g. "39", "ai-0.9.1"'),
  }),
}, async ({ identifier }) => {
  try {
    return textResult(await stopSource(identifier));
  } catch (e) {
    return errorResult(e);
  }
});

// --- Query tools ---

server.registerTool("search_resources", {
  description:
    "Searches for management model resources by name or address pattern.",
  inputSchema: z.object({
    query: z.string().describe("Search term matched against resource name and address"),
    identifier: z.string().describe('Source identifier, e.g. "39"'),
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, async ({ query, identifier, limit }) => {
  try {
    return textResult(await searchResources(identifier, query, limit));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("browse_resource", {
  description:
    "Returns a resource with its children, attributes, operations, and capabilities. The primary drill-down tool.",
  inputSchema: z.object({
    address: z
      .string()
      .describe('Resource address, e.g. "/subsystem=datasources"'),
    identifier: z.string().describe('Source identifier, e.g. "39"'),
  }),
}, async ({ address, identifier }) => {
  try {
    return textResult(await browseResource(identifier, address));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("search_operations", {
  description:
    "Searches operations across all resources by name or description.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search term matched against operation name and description"),
    identifier: z.string().describe('Source identifier, e.g. "39"'),
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, async ({ query, identifier, limit }) => {
  try {
    return textResult(await searchOperations(identifier, query, limit));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("search_attributes", {
  description:
    "Searches attributes across all resources. Can filter to only deprecated attributes.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search term matched against attribute name and description"),
    identifier: z.string().describe('Source identifier, e.g. "39"'),
    deprecated: z
      .boolean()
      .optional()
      .describe("If true, only return deprecated attributes"),
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, async ({ query, identifier, deprecated, limit }) => {
  try {
    return textResult(
      await searchAttributes(identifier, query, deprecated, limit)
    );
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("find_capabilities", {
  description:
    "Searches for capabilities by name and shows which resources declare or reference them.",
  inputSchema: z.object({
    query: z.string().describe("Search term matched against capability name"),
    identifier: z.string().describe('Source identifier, e.g. "39"'),
  }),
}, async ({ query, identifier }) => {
  try {
    return textResult(await findCapabilities(identifier, query));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("find_deprecated", {
  description:
    "Finds all deprecated elements (resources, attributes, operations), optionally filtered by version or type.",
  inputSchema: z.object({
    identifier: z.string().describe('Source identifier, e.g. "39"'),
    since_version: z
      .string()
      .optional()
      .describe('Only show items deprecated since this version, e.g. "25.0.0"'),
    element_type: z
      .string()
      .optional()
      .describe('Filter by type: "resource", "attribute", or "operation"'),
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
}, async ({ identifier, since_version, element_type, limit }) => {
  try {
    return textResult(
      await findDeprecated(identifier, since_version, element_type, limit)
    );
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("compare_versions", {
  description:
    "Compares two sources to find added, removed, and newly deprecated resources/attributes/operations.",
  inputSchema: z.object({
    identifier1: z.string().describe('Older source identifier, e.g. "38"'),
    identifier2: z.string().describe('Newer source identifier, e.g. "39"'),
  }),
}, async ({ identifier1, identifier2 }) => {
  try {
    return textResult(await compareVersions(identifier1, identifier2));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("run_cypher", {
  description:
    "Escape hatch for advanced users: runs an arbitrary read-only Cypher query against a source. Results capped at 100 rows with a 10s timeout.",
  inputSchema: z.object({
    query: z.string().describe("Cypher query to execute"),
    identifier: z.string().describe('Source identifier, e.g. "39"'),
  }),
}, async ({ query, identifier }) => {
  try {
    return textResult(await runCypher(identifier, query));
  } catch (e) {
    return errorResult(e);
  }
});

// --- Server startup ---

async function main() {
  process.on("SIGINT", async () => {
    await closeAll();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await closeAll();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WildFly Model Graph MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
