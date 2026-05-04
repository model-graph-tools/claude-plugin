import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";
import { toNumber } from "../utils.js";

const DEFAULT_LIMIT = 50;

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

    if (types.includes("attribute")) {
      queries.push(
        `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)-[d:DEPRECATED_SINCE]->(v:Version)
         ${sinceVersion ? "WHERE v.ordinal >= $sinceOrdinal" : ""}
         RETURN 'attribute' AS elementType,
                a.name AS name,
                r.address AS resource,
                v.name AS deprecatedSince,
                d.reason AS reason`
      );
    }

    if (types.includes("operation")) {
      queries.push(
        `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)-[d:DEPRECATED_SINCE]->(v:Version)
         ${sinceVersion ? "WHERE v.ordinal >= $sinceOrdinal" : ""}
         RETURN 'operation' AS elementType,
                o.name AS name,
                r.address AS resource,
                v.name AS deprecatedSince,
                d.reason AS reason`
      );
    }

    if (types.includes("parameter")) {
      queries.push(
        `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)-[d:DEPRECATED_SINCE]->(v:Version)
         ${sinceVersion ? "WHERE v.ordinal >= $sinceOrdinal" : ""}
         RETURN 'parameter' AS elementType,
                p.name AS name,
                r.address AS resource,
                v.name AS deprecatedSince,
                d.reason AS reason`
      );
    }

    if (types.includes("resource")) {
      queries.push(
        `MATCH (r:Resource)-[d:DEPRECATED_SINCE]->(v:Version)
         ${sinceVersion ? "WHERE v.ordinal >= $sinceOrdinal" : ""}
         RETURN 'resource' AS elementType,
                r.address AS name,
                null AS resource,
                v.name AS deprecatedSince,
                d.reason AS reason`
      );
    }

    const unionQuery = queries.join("\nUNION ALL\n");
    const fullQuery = `${unionQuery}\nORDER BY deprecatedSince DESC, name\nLIMIT $limit`;

    const sinceOrdinal = sinceVersion ? versionToOrdinal(sinceVersion) : 0;

    const params: Record<string, unknown> = { limit: neo4j.int(limit) };
    if (sinceVersion) {
      params.sinceOrdinal = neo4j.int(sinceOrdinal);
    }

    const result = await session.run(fullQuery, params);

    const countQuery = `${queries.join("\nUNION ALL\n")}`;
    const countWrapper = `CALL { ${countQuery} } RETURN count(*) AS total`;

    let totalCount = result.records.length;
    try {
      const countResult = await session.run(countWrapper, params);
      totalCount = toNumber(countResult.records[0]?.get("total"));
    } catch (countError) {
      console.error("Count subquery failed, using result length:", countError);
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

function versionToOrdinal(version: string): number {
  const parts = version.replace(/\.Final.*$/, "").split(".");
  const major = parseInt(parts[0] ?? "0", 10);
  const minor = parseInt(parts[1] ?? "0", 10);
  return major * 10 + minor;
}
