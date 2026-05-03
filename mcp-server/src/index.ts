import { createRequire } from "node:module";
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";
import { resolveIdentifier, resolveIdentifiers } from "./identifiers.js";
import { mgtStop } from "./mgt.js";
import { closeAll } from "./neo4j.js";
import { getStartedBySession } from "./session.js";
import { listSources } from "./tools/list-sources.js";
import { startSource } from "./tools/start-source.js";
import { stopSource } from "./tools/stop-source.js";
import { searchResources } from "./tools/search-resources.js";
import { browseResource } from "./tools/browse-resource.js";
import { describeResource } from "./tools/describe-resource.js";
import { searchOperations } from "./tools/search-operations.js";
import { searchAttributes } from "./tools/search-attributes.js";
import { findCapabilities } from "./tools/find-capabilities.js";
import { findDeprecated } from "./tools/find-deprecated.js";
import { findByStability } from "./tools/find-by-stability.js";
import { compareVersions } from "./tools/compare-versions.js";
import { getStatistics } from "./tools/get-statistics.js";
import { runCypher } from "./tools/run-cypher.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const server = new McpServer({
  name: "wildfly-model-graph",
  version,
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
    "Lists all known WildFly versions and feature packs with their availability (running/stopped/not_found).",
}, async () => {
  try {
    return textResult(await listSources());
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("start_source", {
  description:
    "Starts the model graph for a WildFly version or feature pack. Downloads data automatically if needed — this may take up to a minute on first use. Note: this starts the model graph database, not WildFly itself.",
  inputSchema: z.object({
    identifier: z
      .string()
      .describe('WildFly version or feature pack, e.g. "39", "26.1", "ai:0.9.1"'),
  }),
}, async ({ identifier }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(await startSource(resolved));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("stop_source", {
  description: "Stops the model graph for a WildFly version or feature pack.",
  inputSchema: z.object({
    identifier: z
      .string()
      .describe('WildFly version or feature pack, e.g. "39", "ai:0.9.1"'),
  }),
}, async ({ identifier }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(await stopSource(resolved));
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
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, async ({ query, identifier, limit }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(await searchResources(resolved, query, limit));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("browse_resource", {
  description:
    "Returns a resource with its children, attributes, operations, and capabilities. The primary drill-down tool. Includes description, stability, parent, full attribute metadata, operation stability, and parameter relationships (requires/alternatives).",
  inputSchema: z.object({
    address: z
      .string()
      .describe('Resource address, e.g. "/subsystem=datasources"'),
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
  }),
}, async ({ address, identifier }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(await browseResource(resolved, address));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("describe_resource", {
  description:
    "Returns a concise, human-readable description of a resource — its purpose, required add-operation parameters, required and optional attributes, and a CLI example. Use this for 'how do I add/configure X?' questions instead of browse_resource.",
  inputSchema: z.object({
    address: z
      .string()
      .describe('Resource address, e.g. "/subsystem=datasources/data-source=*"'),
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
  }),
}, async ({ address, identifier }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    const markdown = await describeResource(resolved, address);
    return { content: [{ type: "text" as const, text: markdown }] };
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
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, async ({ query, identifier, limit }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(await searchOperations(resolved, query, limit));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("search_attributes", {
  description:
    "Searches attributes across all resources. Can filter to only deprecated attributes or by stability level.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search term matched against attribute name and description"),
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
    deprecated: z
      .boolean()
      .optional()
      .describe("If true, only return deprecated attributes"),
    stability: z
      .string()
      .optional()
      .describe('Filter by stability level: "experimental", "preview", "community", or "default"'),
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, async ({ query, identifier, deprecated, stability, limit }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(
      await searchAttributes(resolved, query, deprecated, stability, limit)
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
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
  }),
}, async ({ query, identifier }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(await findCapabilities(resolved, query));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("find_deprecated", {
  description:
    "Finds all deprecated elements (resources, attributes, operations), optionally filtered by version or type.",
  inputSchema: z.object({
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
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
    const resolved = await resolveIdentifier(identifier);
    return textResult(
      await findDeprecated(resolved, since_version, element_type, limit)
    );
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("find_by_stability", {
  description:
    "Finds all elements (resources, attributes, operations) with a given stability level, optionally filtered by type. Mainly useful for non-default levels (experimental, preview, community).",
  inputSchema: z.object({
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
    stability: z
      .string()
      .describe('Stability level: "experimental", "preview", "community", or "default"'),
    element_type: z
      .string()
      .optional()
      .describe('Filter by type: "resource", "attribute", or "operation"'),
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
}, async ({ identifier, stability, element_type, limit }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(
      await findByStability(resolved, stability, element_type, limit)
    );
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("get_statistics", {
  description:
    "Overview of the management model: node counts, stability breakdown per element type, deprecation counts, and relationship counts.",
  inputSchema: z.object({
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
  }),
}, async ({ identifier }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(await getStatistics(resolved));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("compare_versions", {
  description:
    "Compares two WildFly versions or feature packs to find added, removed, and newly deprecated resources/attributes/operations. Also detects attribute and operation changes within resources that exist in both versions.",
  inputSchema: z.object({
    identifier1: z.string().describe('Older WildFly version or feature pack, e.g. "38"'),
    identifier2: z.string().describe('Newer WildFly version or feature pack, e.g. "39"'),
  }),
}, async ({ identifier1, identifier2 }) => {
  try {
    const [resolved1, resolved2] = await resolveIdentifiers(identifier1, identifier2);
    return textResult(await compareVersions(resolved1, resolved2));
  } catch (e) {
    return errorResult(e);
  }
});

server.registerTool("run_cypher", {
  description:
    "Escape hatch for advanced users: runs an arbitrary read-only Cypher query against the management model. Results capped at 100 rows with a 10s timeout.",
  inputSchema: z.object({
    query: z.string().describe("Cypher query to execute"),
    identifier: z.string().describe('WildFly version or feature pack, e.g. "39"'),
  }),
}, async ({ query, identifier }) => {
  try {
    const resolved = await resolveIdentifier(identifier);
    return textResult(await runCypher(resolved, query));
  } catch (e) {
    return errorResult(e);
  }
});

// --- Server startup ---

async function shutdown(): Promise<void> {
  await closeAll();
  const stopPromises = Array.from(getStartedBySession()).map((id) =>
    mgtStop(id).catch(() => {})
  );
  await Promise.all(stopPromises);
}

async function main() {
  process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await shutdown();
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
