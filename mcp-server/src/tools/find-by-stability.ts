import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";

const DEFAULT_LIMIT = 50;

interface StabilityElement {
  elementType: string;
  name: string;
  resource?: string;
  stability: string;
}

interface FindByStabilityResult {
  results: StabilityElement[];
  totalCount: number;
}

export async function findByStability(
  identifier: string,
  stability: string,
  elementType?: string,
  limit: number = DEFAULT_LIMIT
): Promise<FindByStabilityResult> {
  const session = await getSession(identifier);
  try {
    const queries: string[] = [];
    const types = elementType
      ? [elementType]
      : ["resource", "attribute", "operation", "parameter"];

    if (types.includes("resource")) {
      queries.push(
        `MATCH (r:Resource)
         WHERE r.stability = $stability
         RETURN 'resource' AS elementType,
                r.address AS name,
                null AS resource,
                r.stability AS stability`
      );
    }

    if (types.includes("attribute")) {
      queries.push(
        `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
         WHERE a.stability = $stability
         RETURN 'attribute' AS elementType,
                a.name AS name,
                r.address AS resource,
                a.stability AS stability`
      );
    }

    if (types.includes("operation")) {
      queries.push(
        `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)
         WHERE o.stability = $stability
         RETURN 'operation' AS elementType,
                o.name AS name,
                r.address AS resource,
                o.stability AS stability`
      );
    }

    if (types.includes("parameter")) {
      queries.push(
        `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)
         WHERE p.stability = $stability
         RETURN 'parameter' AS elementType,
                p.name AS name,
                r.address AS resource,
                p.stability AS stability`
      );
    }

    const unionQuery = queries.join("\nUNION ALL\n");
    const fullQuery = `${unionQuery}\nORDER BY elementType, name\nLIMIT $limit`;

    const params: Record<string, unknown> = {
      stability,
      limit: neo4j.int(limit),
    };

    const result = await session.run(fullQuery, params);

    let totalCount = result.records.length;
    try {
      const countWrapper = `CALL { ${unionQuery} } RETURN count(*) AS total`;
      const countResult = await session.run(countWrapper, { stability });
      totalCount = toNumber(countResult.records[0]?.get("total"));
    } catch {
      // CALL subquery may not be supported; fall back to result length
    }

    return {
      results: result.records.map((r) => {
        const elem: StabilityElement = {
          elementType: r.get("elementType") as string,
          name: r.get("name") as string,
          stability: r.get("stability") as string,
        };
        const res = r.get("resource");
        if (res != null) elem.resource = res as string;
        return elem;
      }),
      totalCount,
    };
  } finally {
    await session.close();
  }
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return 0;
}
