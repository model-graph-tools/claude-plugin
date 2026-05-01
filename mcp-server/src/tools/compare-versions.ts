import { getSession, hasConnection } from "../neo4j.js";
import { startSource } from "./start-source.js";

interface CompareResult {
  identifier1: string;
  identifier2: string;
  added: string[];
  removed: string[];
  newlyDeprecated: DeprecatedInfo[];
}

interface DeprecatedInfo {
  elementType: string;
  name: string;
  resource?: string;
  deprecatedSince: string;
  reason?: string;
}

export async function compareVersions(
  identifier1: string,
  identifier2: string
): Promise<CompareResult> {
  for (const id of [identifier1, identifier2]) {
    if (!hasConnection(id)) {
      await startSource(id);
    }
  }

  const [addresses1, addresses2, deprecated1, deprecated2] = await Promise.all([
    getResourceAddresses(identifier1),
    getResourceAddresses(identifier2),
    getDeprecatedKeys(identifier1),
    getDeprecatedKeys(identifier2),
  ]);

  const set1 = new Set(addresses1);
  const set2 = new Set(addresses2);

  const added = addresses2.filter((a) => !set1.has(a)).sort();
  const removed = addresses1.filter((a) => !set2.has(a)).sort();

  const depKeys1 = new Set(deprecated1.map((d) => `${d.elementType}:${d.name}`));
  const newlyDeprecated = deprecated2.filter(
    (d) => !depKeys1.has(`${d.elementType}:${d.name}`)
  );

  return { identifier1, identifier2, added, removed, newlyDeprecated };
}

async function getResourceAddresses(identifier: string): Promise<string[]> {
  const session = getSession(identifier);
  try {
    const result = await session.run(
      "MATCH (r:Resource) RETURN r.address AS address ORDER BY address"
    );
    return result.records.map((r) => r.get("address") as string);
  } finally {
    await session.close();
  }
}

async function getDeprecatedKeys(identifier: string): Promise<DeprecatedInfo[]> {
  const session = getSession(identifier);
  try {
    const result = await session.run(
      `MATCH (a:Attribute)-[d:DEPRECATED_SINCE]->(v:Version)
       OPTIONAL MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a)
       RETURN 'attribute' AS elementType, a.name AS name, r.address AS resource,
              v.name AS deprecatedSince, d.reason AS reason
       UNION ALL
       MATCH (o:Operation)-[d:DEPRECATED_SINCE]->(v:Version)
       OPTIONAL MATCH (r:Resource)-[:PROVIDES]->(o)
       RETURN 'operation' AS elementType, o.name AS name, r.address AS resource,
              v.name AS deprecatedSince, d.reason AS reason
       UNION ALL
       MATCH (r:Resource)-[d:DEPRECATED_SINCE]->(v:Version)
       RETURN 'resource' AS elementType, r.address AS name, null AS resource,
              v.name AS deprecatedSince, d.reason AS reason`
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
