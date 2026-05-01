import { listSources } from "./src/tools/list-sources.js";
import { searchResources } from "./src/tools/search-resources.js";
import { browseResource } from "./src/tools/browse-resource.js";
import { searchOperations } from "./src/tools/search-operations.js";
import { findCapabilities } from "./src/tools/find-capabilities.js";
import { findDeprecated } from "./src/tools/find-deprecated.js";
import { runCypher } from "./src/tools/run-cypher.js";
import { registerConnection, closeAll } from "./src/neo4j.js";

registerConnection("39.0", 6390);

async function test() {
  console.log("=== list_sources ===");
  const { activeSource, sources } = await listSources();
  const running = sources.filter((s) => s.status === "running");
  console.log(`Found ${sources.length} sources, ${running.length} running, active: ${activeSource ?? "none"}`);

  console.log("\n=== search_resources: datasource ===");
  const resources = await searchResources("39.0", "datasource", 5);
  console.log(
    `Found ${resources.totalCount} resources, showing ${resources.results.length}`
  );
  for (const r of resources.results)
    console.log(`  ${r.address} (${r.childCount} children)`);

  console.log("\n=== browse_resource: /subsystem=datasources ===");
  const res = await browseResource("39.0", "/subsystem=datasources");
  console.log(
    `Children: ${res.children.length}, Attrs: ${res.attributes.length}, Ops: ${res.operations.length}, Caps: ${res.capabilities.length}`
  );

  console.log("\n=== search_operations: test-connection ===");
  const ops = await searchOperations("39.0", "test-connection", 3);
  console.log(`Found ${ops.totalCount} operations`);
  for (const op of ops.results)
    console.log(`  ${op.operation} on ${op.resource}`);

  console.log("\n=== find_capabilities: data-source ===");
  const caps = await findCapabilities("39.0", "data-source");
  console.log(`Found ${caps.length} capabilities`);
  for (const c of caps) console.log(`  ${c.capability} (declared by ${c.declaredBy.length} resources)`);

  console.log("\n=== find_deprecated ===");
  const deprecated = await findDeprecated("39.0", undefined, undefined, 5);
  console.log(`Found ${deprecated.totalCount} deprecated elements, showing ${deprecated.results.length}`);
  for (const d of deprecated.results)
    console.log(`  [${d.elementType}] ${d.name} (since ${d.deprecatedSince})`);

  console.log("\n=== run_cypher ===");
  const cypher = await runCypher(
    "39.0",
    "MATCH (r:Resource) RETURN r.address AS address LIMIT 3"
  );
  console.log(`Columns: ${cypher.columns.join(", ")}, Rows: ${cypher.rowCount}`);

  await closeAll();
  console.log("\nAll tests passed!");
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
