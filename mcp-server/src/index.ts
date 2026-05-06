// MCP server entry point. Registers all tools and starts the stdio transport.
// Tool handlers delegate to per-tool modules in ./tools/.

import { createRequire } from "node:module";
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";
import { resolveIdentifier, resolveIdentifiers } from "./identifiers.js";
import { mgtStop, mgtPs } from "./mgt.js";
import { closeAll, setContainerLookup } from "./neo4j.js";
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
import { getResourceTree } from "./tools/get-resource-tree.js";
import { findRelationships } from "./tools/find-relationships.js";
import { findSensitiveAttributes } from "./tools/find-sensitive-attributes.js";
import { getAllowedValues } from "./tools/get-allowed-values.js";
import { findRestartRequired } from "./tools/find-restart-required.js";
import { findAttributeGroups } from "./tools/find-attribute-groups.js";
import { runCypher } from "./tools/run-cypher.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const server = new McpServer({
  name: "wildfly-model-graph",
  version,
});

// --- Shared schemas ---

const identifierParam = z
  .string()
  .describe('WildFly version or feature pack, e.g. "39"');

const stabilityEnum = z
  .enum(["experimental", "preview", "community", "default"])
  .describe('Stability level: "experimental", "preview", "community", or "default"');

const elementTypeEnum = z
  .enum(["resource", "attribute", "operation", "parameter"])
  .describe('Filter by type: "resource", "attribute", "operation", or "parameter"');

// --- Tool handler wrapper ---

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function handleTool<T>(fn: (params: T) => Promise<unknown>) {
  return async (params: T) => {
    try {
      const result = await fn(params);
      const text =
        typeof result === "string"
          ? result
          : JSON.stringify(result, null, 2);
      return { content: [{ type: "text" as const, text }] };
    } catch (e) {
      return errorResult(e);
    }
  };
}

// --- Lifecycle tools ---

server.registerTool("list_sources", {
  description:
    "Lists all known WildFly versions and feature packs with their availability (running/not_found).",
}, handleTool(async () => {
  return listSources();
}));

server.registerTool("start_source", {
  description:
    "Starts the model graph database for a WildFly version or feature pack. Downloads data automatically if needed — this may take up to a minute on first use. IMPORTANT: This starts the model graph database, NOT the WildFly application server. When describing this action to users, say 'starting the model graph for WildFly X', never 'starting WildFly X'.",
  inputSchema: z.object({
    identifier: z
      .string()
      .describe('WildFly version or feature pack, e.g. "39", "26.1", "ai:0.9.1"'),
  }),
}, handleTool(async ({ identifier }) => {
  const resolved = await resolveIdentifier(identifier);
  return startSource(resolved);
}));

server.registerTool("stop_source", {
  description: "Stops the model graph for a WildFly version or feature pack.",
  inputSchema: z.object({
    identifier: z
      .string()
      .describe('WildFly version or feature pack, e.g. "39", "ai:0.9.1"'),
  }),
}, handleTool(async ({ identifier }) => {
  const resolved = await resolveIdentifier(identifier);
  return stopSource(resolved);
}));

// --- Query tools ---

server.registerTool("search_resources", {
  description:
    "Searches for management model resources by name, address, or description.",
  inputSchema: z.object({
    query: z.string().describe("Search term matched against resource name, address, and description"),
    identifier: identifierParam,
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, handleTool(async ({ query, identifier, limit }) => {
  const resolved = await resolveIdentifier(identifier);
  return searchResources(resolved, query, limit);
}));

server.registerTool("browse_resource", {
  description:
    "Returns a resource with its children, attributes, operations, and capabilities. The primary drill-down tool. Includes description, stability, parent, full attribute metadata (allowed values, units, restart requirements, attribute groups), operation stability and characteristics (read-only, runtime-only, global), parameter relationships (requires/alternatives), and sub-attribute composition via CONSISTS_OF for complex attributes (LIST/OBJECT).",
  inputSchema: z.object({
    address: z
      .string()
      .describe('Resource address, e.g. "/subsystem=datasources"'),
    identifier: identifierParam,
  }),
}, handleTool(async ({ address, identifier }) => {
  const resolved = await resolveIdentifier(identifier);
  return browseResource(resolved, address);
}));

server.registerTool("describe_resource", {
  description:
    "Returns a concise, human-readable description of a resource — its purpose, required add-operation parameters, required and optional attributes, and a CLI example. Use this for 'how do I add/configure X?' questions instead of browse_resource.",
  inputSchema: z.object({
    address: z
      .string()
      .describe('Resource address, e.g. "/subsystem=datasources/data-source=*"'),
    identifier: identifierParam,
  }),
}, handleTool(async ({ address, identifier }) => {
  const resolved = await resolveIdentifier(identifier);
  return describeResource(resolved, address);
}));

server.registerTool("search_operations", {
  description:
    "Searches operations across all resources by name or description. Can filter by resource address, read-only vs. mutating, and runtime-only. Returns stability level, deprecation info, and operation characteristics.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search term matched against operation name and description"),
    identifier: identifierParam,
    resource_filter: z
      .string()
      .optional()
      .describe("Filter to operations in resources matching this address substring"),
    read_only: z
      .boolean()
      .optional()
      .describe("If true, only return read-only operations; if false, only mutating operations"),
    runtime_only: z
      .boolean()
      .optional()
      .describe("If true, only return runtime-only operations"),
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, handleTool(async ({ query, identifier, resource_filter, read_only, runtime_only, limit }) => {
  const resolved = await resolveIdentifier(identifier);
  return searchOperations(resolved, query, resource_filter, read_only, runtime_only, limit);
}));

server.registerTool("search_attributes", {
  description:
    "Searches attributes across all resources. Can filter to only deprecated attributes or by stability level. Returns access type and required flag.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search term matched against attribute name and description"),
    identifier: identifierParam,
    deprecated: z
      .boolean()
      .optional()
      .describe("If true, only return deprecated attributes"),
    stability: stabilityEnum.optional(),
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, handleTool(async ({ query, identifier, deprecated, stability, limit }) => {
  const resolved = await resolveIdentifier(identifier);
  return searchAttributes(resolved, query, deprecated, stability, limit);
}));

server.registerTool("find_capabilities", {
  description:
    "Searches for capabilities by name and shows which resources declare or reference them (via attributes and parameters).",
  inputSchema: z.object({
    query: z.string().describe("Search term matched against capability name"),
    identifier: identifierParam,
  }),
}, handleTool(async ({ query, identifier }) => {
  const resolved = await resolveIdentifier(identifier);
  return findCapabilities(resolved, query);
}));

server.registerTool("find_deprecated", {
  description:
    "Finds all deprecated elements (resources, attributes, operations, and parameters), optionally filtered by version or type.",
  inputSchema: z.object({
    identifier: identifierParam,
    since_version: z
      .string()
      .optional()
      .describe('Only show items deprecated since this management model version, e.g. "25.0.0". Note: this is the management model version, not the WildFly server version.'),
    element_type: elementTypeEnum.optional(),
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
}, handleTool(async ({ identifier, since_version, element_type, limit }) => {
  const resolved = await resolveIdentifier(identifier);
  return findDeprecated(resolved, since_version, element_type, limit);
}));

server.registerTool("find_by_stability", {
  description:
    "Finds all elements (resources, attributes, operations, and parameters) with a given stability level, optionally filtered by type. Mainly useful for non-default levels (experimental, preview, community).",
  inputSchema: z.object({
    identifier: identifierParam,
    stability: stabilityEnum,
    element_type: elementTypeEnum.optional(),
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
}, handleTool(async ({ identifier, stability, element_type, limit }) => {
  const resolved = await resolveIdentifier(identifier);
  return findByStability(resolved, stability, element_type, limit);
}));

server.registerTool("get_statistics", {
  description:
    "Overview of the management model: identity metadata (name, version, type), node counts, stability breakdown per element type, deprecation counts, and relationship counts.",
  inputSchema: z.object({
    identifier: identifierParam,
  }),
}, handleTool(async ({ identifier }) => {
  const resolved = await resolveIdentifier(identifier);
  return getStatistics(resolved);
}));

server.registerTool("compare_versions", {
  description:
    "Compares two WildFly versions or feature packs to find added, removed, and newly deprecated resources/attributes/operations. Also detects attribute, operation, and parameter changes within resources that exist in both versions.",
  inputSchema: z.object({
    identifier1: z.string().describe('Older WildFly version or feature pack, e.g. "38"'),
    identifier2: z.string().describe('Newer WildFly version or feature pack, e.g. "39"'),
  }),
}, handleTool(async ({ identifier1, identifier2 }) => {
  const [resolved1, resolved2] = await resolveIdentifiers(identifier1, identifier2);
  return compareVersions(resolved1, resolved2);
}));

server.registerTool("get_resource_tree", {
  description:
    "Returns all resources in the subtree under a given address. Use to explore the resource hierarchy without recursive browse_resource calls.",
  inputSchema: z.object({
    address: z
      .string()
      .describe('Root address, e.g. "/subsystem=datasources". Use "/" for the full tree'),
    identifier: identifierParam,
    depth: z
      .number()
      .optional()
      .describe("Max depth to traverse (default: unlimited)"),
  }),
}, handleTool(async ({ address, identifier, depth }) => {
  const resolved = await resolveIdentifier(identifier);
  return getResourceTree(resolved, address, depth);
}));

server.registerTool("find_relationships", {
  description:
    "Shows dependency and exclusivity relationships between attributes and between operation parameters for a resource. Exposes REQUIRES (must be set together) and ALTERNATIVE (mutually exclusive) relationships.",
  inputSchema: z.object({
    address: z
      .string()
      .describe('Resource address, e.g. "/subsystem=datasources/data-source=*"'),
    identifier: identifierParam,
    scope: z
      .enum(["attributes", "parameters", "all"])
      .optional()
      .describe('Which relationships to return: "attributes", "parameters", or "all" (default: "all")'),
  }),
}, handleTool(async ({ address, identifier, scope }) => {
  const resolved = await resolveIdentifier(identifier);
  return findRelationships(resolved, address, scope);
}));

server.registerTool("find_sensitive_attributes", {
  description:
    "Find security-sensitive attributes marked with IS_SENSITIVE constraints. Returns attributes with their constraint type and resource. Use to audit passwords, keys, and other secrets in the management model.",
  inputSchema: z.object({
    identifier: identifierParam,
    query: z
      .string()
      .optional()
      .describe("Optional filter by attribute name or resource address"),
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
}, handleTool(async ({ identifier, query, limit }) => {
  const resolved = await resolveIdentifier(identifier);
  return findSensitiveAttributes(resolved, query, limit);
}));

server.registerTool("get_allowed_values", {
  description:
    "Get allowed option values, numeric ranges, and string length constraints for attributes and parameters. Answers 'what values can I set for X?' questions.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search term matched against attribute or parameter name and description"),
    identifier: identifierParam,
    limit: z.number().optional().describe("Max results (default 25)"),
  }),
}, handleTool(async ({ query, identifier, limit }) => {
  const resolved = await resolveIdentifier(identifier);
  return getAllowedValues(resolved, query, limit);
}));

server.registerTool("find_restart_required", {
  description:
    'Find attributes that require a server restart after modification. Filter by restart level (no-services, all-services, jvm) and/or resource address. Answers "what changes need a server restart?" questions.',
  inputSchema: z.object({
    identifier: identifierParam,
    restart_type: z
      .enum(["no-services", "all-services", "jvm"])
      .optional()
      .describe('Filter by restart level: "no-services", "all-services", or "jvm"'),
    resource_filter: z
      .string()
      .optional()
      .describe("Filter results to a resource address substring"),
    limit: z.number().optional().describe("Max results (default 50)"),
  }),
}, handleTool(async ({ identifier, restart_type, resource_filter, limit }) => {
  const resolved = await resolveIdentifier(identifier);
  return findRestartRequired(resolved, restart_type, resource_filter, limit);
}));

server.registerTool("find_attribute_groups", {
  description:
    "Discover attribute groups — logical groupings of related attributes within resources. Filter by resource address or group name.",
  inputSchema: z.object({
    identifier: identifierParam,
    resource: z
      .string()
      .optional()
      .describe("Specific resource address to query"),
    group_name: z
      .string()
      .optional()
      .describe("Filter by group name substring"),
  }),
}, handleTool(async ({ identifier, resource, group_name }) => {
  const resolved = await resolveIdentifier(identifier);
  return findAttributeGroups(resolved, resource, group_name);
}));

server.registerTool("run_cypher", {
  description:
    "Escape hatch for advanced users: runs an arbitrary read-only Cypher query against the management model. Results capped at 100 rows with a 10s timeout.",
  inputSchema: z.object({
    query: z.string().describe("Cypher query to execute"),
    identifier: identifierParam,
  }),
}, handleTool(async ({ query, identifier }) => {
  const resolved = await resolveIdentifier(identifier);
  return runCypher(resolved, query);
}));

// --- Server startup ---

async function shutdown(): Promise<void> {
  await closeAll();
  const stopPromises = Array.from(getStartedBySession()).map((id) =>
    mgtStop(id).catch((err) => {
      console.error(`Failed to stop ${id} during shutdown:`, err);
    })
  );
  await Promise.all(stopPromises);
}

setContainerLookup(async (identifier: string) => {
  try {
    const containers = await mgtPs();
    const match = containers.find((c) => c.identifier === identifier);
    return match ? { bolt: match.bolt } : null;
  } catch {
    return null;
  }
});

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
