// Diffs two model graphs for added/removed resources, newly deprecated elements,
// and attribute/operation/parameter changes within resources that exist in both.
// Automatically starts containers for both identifiers if not already running.

import { getSession, hasConnection } from "../neo4j.js";
import { startSource } from "./start-source.js";

// --- Types ---

interface ChangedParameters {
  resource: string;
  operation: string;
  added: string[];
  removed: string[];
}

interface CompareResult {
  identifier1: string;
  identifier2: string;
  added: string[];
  removed: string[];
  newlyDeprecated: DeprecatedInfo[];
  changedAttributes: ChangedElements[];
  changedOperations: ChangedElements[];
  changedParameters: ChangedParameters[];
}

interface DeprecatedInfo {
  elementType: string;
  name: string;
  resource?: string;
  deprecatedSince: string;
  reason?: string;
}

interface ChangedElements {
  resource: string;
  added: string[];
  removed: string[];
}

// --- Main ---

export async function compareVersions(
  identifier1: string,
  identifier2: string
): Promise<CompareResult> {
  for (const id of [identifier1, identifier2]) {
    if (!hasConnection(id)) {
      await startSource(id);
    }
  }

  const [
    addresses1, addresses2,
    deprecated1, deprecated2,
    attrs1, attrs2,
    ops1, ops2,
    params1, params2,
  ] = await Promise.all([
    getResourceAddresses(identifier1),
    getResourceAddresses(identifier2),
    getDeprecatedKeys(identifier1),
    getDeprecatedKeys(identifier2),
    getElementsByResource(identifier1, "attribute"),
    getElementsByResource(identifier2, "attribute"),
    getElementsByResource(identifier1, "operation"),
    getElementsByResource(identifier2, "operation"),
    getParametersByOperation(identifier1),
    getParametersByOperation(identifier2),
  ]);

  const set1 = new Set(addresses1);
  const set2 = new Set(addresses2);

  const added = addresses2.filter((a) => !set1.has(a)).sort();
  const removed = addresses1.filter((a) => !set2.has(a)).sort();

  const depKeys1 = new Set(deprecated1.map((d) => `${d.elementType}:${d.name}`));
  const newlyDeprecated = deprecated2.filter(
    (d) => !depKeys1.has(`${d.elementType}:${d.name}`)
  );

  const commonAddresses = addresses2.filter((a) => set1.has(a));

  const changedAttributes = computeChanges(commonAddresses, attrs1, attrs2);
  const changedOperations = computeChanges(commonAddresses, ops1, ops2);
  const changedParameters = computeParameterChanges(commonAddresses, ops1, ops2, params1, params2);

  return {
    identifier1,
    identifier2,
    added,
    removed,
    newlyDeprecated,
    changedAttributes,
    changedOperations,
    changedParameters,
  };
}

// --- Set-difference helpers ---

function computeChanges(
  commonAddresses: string[],
  map1: Map<string, Set<string>>,
  map2: Map<string, Set<string>>
): ChangedElements[] {
  const results: ChangedElements[] = [];
  for (const addr of commonAddresses) {
    const s1 = map1.get(addr) ?? new Set<string>();
    const s2 = map2.get(addr) ?? new Set<string>();
    const addedElems = [...s2].filter((n) => !s1.has(n)).sort();
    const removedElems = [...s1].filter((n) => !s2.has(n)).sort();
    if (addedElems.length > 0 || removedElems.length > 0) {
      results.push({ resource: addr, added: addedElems, removed: removedElems });
    }
  }
  return results.sort((a, b) => a.resource.localeCompare(b.resource));
}

// --- Data fetchers ---

async function getResourceAddresses(identifier: string): Promise<string[]> {
  const session = await getSession(identifier);
  try {
    const result = await session.run(
      "MATCH (r:Resource) RETURN r.address AS address ORDER BY address"
    );
    return result.records.map((r) => r.get("address") as string);
  } finally {
    await session.close();
  }
}

async function getElementsByResource(
  identifier: string,
  elementType: "attribute" | "operation"
): Promise<Map<string, Set<string>>> {
  const session = await getSession(identifier);
  try {
    const query =
      elementType === "attribute"
        ? `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
           RETURN r.address AS resource, collect(a.name) AS names`
        : `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)
           RETURN r.address AS resource, collect(o.name) AS names`;

    const result = await session.run(query);
    const map = new Map<string, Set<string>>();
    for (const r of result.records) {
      map.set(
        r.get("resource") as string,
        new Set(r.get("names") as string[])
      );
    }
    return map;
  } finally {
    await session.close();
  }
}

async function getDeprecatedKeys(identifier: string): Promise<DeprecatedInfo[]> {
  const session = await getSession(identifier);
  try {
    const result = await session.run(
      `MATCH (a:Attribute)-[d:DEPRECATED_SINCE]->(v:Version)
       OPTIONAL MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a)
       RETURN 'attribute' AS elementType, a.name AS name, r.address AS resource,
              (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince, d.reason AS reason
       UNION ALL
       MATCH (o:Operation)-[d:DEPRECATED_SINCE]->(v:Version)
       OPTIONAL MATCH (r:Resource)-[:PROVIDES]->(o)
       RETURN 'operation' AS elementType, o.name AS name, r.address AS resource,
              (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince, d.reason AS reason
       UNION ALL
       MATCH (r:Resource)-[d:DEPRECATED_SINCE]->(v:Version)
       RETURN 'resource' AS elementType, r.address AS name, null AS resource,
              (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince, d.reason AS reason`
    );
    return result.records.map((r) => {
      const elem: DeprecatedInfo = {
        elementType: r.get("elementType") as string,
        name: r.get("name") as string,
        deprecatedSince: r.get("deprecatedSince") as string,
      };
      const res = r.get("resource");
      if (res != null) elem.resource = res as string;
      const reason = r.get("reason");
      if (reason != null) elem.reason = reason as string;
      return elem;
    });
  } finally {
    await session.close();
  }
}

async function getParametersByOperation(
  identifier: string
): Promise<Map<string, Map<string, Set<string>>>> {
  const session = await getSession(identifier);
  try {
    const result = await session.run(
      `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)
       RETURN r.address AS resource, o.name AS operation, collect(p.name) AS names`
    );
    const map = new Map<string, Map<string, Set<string>>>();
    for (const r of result.records) {
      const resource = r.get("resource") as string;
      const operation = r.get("operation") as string;
      const names = new Set(r.get("names") as string[]);
      if (!map.has(resource)) {
        map.set(resource, new Map());
      }
      map.get(resource)!.set(operation, names);
    }
    return map;
  } finally {
    await session.close();
  }
}

function computeParameterChanges(
  commonAddresses: string[],
  ops1: Map<string, Set<string>>,
  ops2: Map<string, Set<string>>,
  params1: Map<string, Map<string, Set<string>>>,
  params2: Map<string, Map<string, Set<string>>>
): ChangedParameters[] {
  const results: ChangedParameters[] = [];
  for (const addr of commonAddresses) {
    const opsInBoth1 = ops1.get(addr) ?? new Set<string>();
    const opsInBoth2 = ops2.get(addr) ?? new Set<string>();
    const commonOps = [...opsInBoth2].filter((o) => opsInBoth1.has(o));
    const opParams1 = params1.get(addr) ?? new Map<string, Set<string>>();
    const opParams2 = params2.get(addr) ?? new Map<string, Set<string>>();
    for (const op of commonOps) {
      const p1 = opParams1.get(op) ?? new Set<string>();
      const p2 = opParams2.get(op) ?? new Set<string>();
      const added = [...p2].filter((n) => !p1.has(n)).sort();
      const removed = [...p1].filter((n) => !p2.has(n)).sort();
      if (added.length > 0 || removed.length > 0) {
        results.push({ resource: addr, operation: op, added, removed });
      }
    }
  }
  return results.sort((a, b) =>
    a.resource === b.resource
      ? a.operation.localeCompare(b.operation)
      : a.resource.localeCompare(b.resource)
  );
}
