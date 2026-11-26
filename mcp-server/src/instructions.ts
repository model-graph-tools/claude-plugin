// Server-level instructions sent to every MCP client during initialization.
// Keeps the critical source-selection rules independent of the agent skill.

export const SERVER_INSTRUCTIONS = `Explore the WildFly management model (resources, attributes, operations, capabilities, deprecations) stored in per-version Neo4j model graphs. Always ground answers in these tools instead of answering from memory.

Choosing a model graph (the "identifier" parameter):
- If the user names a WildFly version or feature pack, use it (e.g. "WildFly 39" -> "39", "AI feature pack" -> "ai", "ai:0.9.1").
- Otherwise, call list_sources and pick, in order:
  1. The active model graph (activeSource), if any.
  2. The only running model graph, if exactly one is running.
  3. The latest running WildFly version, if several are running (prefer a running feature pack when the question is clearly about that feature pack).
  4. If no model graph is running, call start_source for the latest WildFly version (list_sources returns a "hint" with the exact identifier), then query it. Do not give up and answer from memory.
- The first start_source call may take up to a minute while the image is downloaded.

start_source starts the model graph database, not a WildFly server. Describe it as "starting the model graph for WildFly X".`;
