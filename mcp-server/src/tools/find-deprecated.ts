// Finds deprecated elements across the model graph, optionally filtered by
// management model version and element type. Builds a UNION ALL query per type.

import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";
import { toNumber } from "../utils.js";

// --- Constants ---

const DEFAULT_LIMIT = 50;

// --- Types ---

interface DeprecatedElement {
  elementType: string;
  name: string;
  resource?: string;
  deprecatedSince: string;
  reason?: string;
}

interface FindDeprecatedResult {
  results: DeprecatedElement[];
  totalCount: number;
}

export async function findDeprecated(
  identifier: string,
  sinceVersion?: string,
  elementType?: string,
  limit: number = DEFAULT_LIMIT
): Promise<FindDeprecatedResult> {
  const session = await getSession(identifier);
  try {
    const queries: string[] = [];
    const types = elementType
      ? [elementType]
      : ["resource", "attribute", "operation", "parameter"];

    const versionFilter = sinceVersion ? buildVersionFilter() : "";

    if (types.includes("attribute")) {
      queries.push(
        `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)-[d:DEPRECATED_SINCE]->(v:Version)
         ${versionFilter}
         RETURN 'attribute' AS elementType,
                a.name AS name,
                r.address AS resource,
                (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince,
                v.major AS _major, v.minor AS _minor, v.patch AS _patch,
                d.reason AS reason`
      );
    }

    if (types.includes("operation")) {
      queries.push(
        `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)-[d:DEPRECATED_SINCE]->(v:Version)
         ${versionFilter}
         RETURN 'operation' AS elementType,
                o.name AS name,
                r.address AS resource,
                (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince,
                v.major AS _major, v.minor AS _minor, v.patch AS _patch,
                d.reason AS reason`
      );
    }

    if (types.includes("parameter")) {
      queries.push(
        `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)-[d:DEPRECATED_SINCE]->(v:Version)
         ${versionFilter}
         RETURN 'parameter' AS elementType,
                p.name AS name,
                r.address AS resource,
                (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince,
                v.major AS _major, v.minor AS _minor, v.patch AS _patch,
                d.reason AS reason`
      );
    }

    if (types.includes("resource")) {
      queries.push(
        `MATCH (r:Resource)-[d:DEPRECATED_SINCE]->(v:Version)
         ${versionFilter}
         RETURN 'resource' AS elementType,
                r.address AS name,
                null AS resource,
                (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince,
                v.major AS _major, v.minor AS _minor, v.patch AS _patch,
                d.reason AS reason`
      );
    }

    const unionQuery = queries.join("\nUNION ALL\n");
    const fullQuery = `${unionQuery}\nORDER BY _major DESC, _minor DESC, _patch DESC, name\nLIMIT $limit`;

    const params: Record<string, unknown> = { limit: neo4j.int(limit) };
    if (sinceVersion) {
      const parsed = parseVersion(sinceVersion);
      params.sinceMajor = neo4j.int(parsed.major);
      params.sinceMinor = neo4j.int(parsed.minor);
      params.sincePatch = neo4j.int(parsed.patch);
    }

    const result = await session.run(fullQuery, params);

    let totalCount = result.records.length;
    try {
      const countWrapper = `CALL { ${unionQuery} } RETURN count(*) AS total`;
      const countResult = await session.run(countWrapper, params);
      totalCount = toNumber(countResult.records[0]?.get("total"));
    } catch {
      // Fallback: use result length if CALL subquery is not supported
    }

    return {
      results: result.records.map((r) => {
        const elem: DeprecatedElement = {
          elementType: r.get("elementType") as string,
          name: r.get("name") as string,
          deprecatedSince: r.get("deprecatedSince") as string,
        };
        const res = r.get("resource");
        if (res != null) elem.resource = res as string;
        const reason = r.get("reason");
        if (reason != null) elem.reason = reason as string;
        return elem;
      }),
      totalCount,
    };
  } finally {
    await session.close();
  }
}

function buildVersionFilter(): string {
  return `WHERE (v.major > $sinceMajor
         OR (v.major = $sinceMajor AND v.minor > $sinceMinor)
         OR (v.major = $sinceMajor AND v.minor = $sinceMinor AND v.patch >= $sincePatch))`;
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.replace(/\.Final.*$/, "").split(".");
  return {
    major: parseInt(parts[0] ?? "0", 10),
    minor: parseInt(parts[1] ?? "0", 10),
    patch: parseInt(parts[2] ?? "0", 10),
  };
}
