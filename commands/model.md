---
description: Explore the WildFly management model — search resources, attributes, operations, capabilities, and deprecations across versions and feature packs
argument-hint: your question about the WildFly management model
allowed-tools: mcp:wildfly-model-graph:*
---

The user wants to explore the WildFly management model.

## Instructions

1. Load the `mgt:wildfly-model-graph` skill first to understand the domain and tool usage patterns.
2. Answer the query using ONLY the MCP tools provided by the `wildfly-model-graph` MCP server:
   `list_sources`, `start_source`, `stop_source`, `search_resources`, `browse_resource`,
   `describe_resource`, `search_operations`, `search_attributes`, `find_capabilities`,
   `find_deprecated`, `find_by_stability`, `get_statistics`, `compare_versions`,
   `get_resource_tree`, `find_relationships`, `run_cypher`.
3. **NEVER run `mgt` as a shell command.** The `mgt` CLI is an internal dependency of the MCP server — it is not meant to be called directly. All interaction goes through the MCP tools above.
4. **NEVER read cached tool-result JSON files** (`cat ...tool-results/*.json`) or pipe MCP output through `python3`/`jq`/Bash to parse it. Summarize directly from tool responses. If a response is too large, use `run_cypher` with a targeted query.
5. If an MCP tool returns an error about `mgt` not being found, tell the user to install it from https://github.com/model-graph-tools/tooling — do NOT try to run it via bash as a fallback.

## User query

$ARGUMENTS
