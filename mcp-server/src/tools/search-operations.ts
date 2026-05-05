import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";
import { escapeRegex, toNumber, validateQueryLength } from "../utils.js";

const DEFAULT_LIMIT = 25;

interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
}

interface OperationResult {
  resource: string;
  operation: string;
  description: string;
  stability?: string;
  parameters: ParameterInfo[];
  deprecatedSince?: string;
  deprecationReason?: string;
}

interface SearchOperationsResult {
  results: OperationResult[];
  totalCount: number;
}

export async function searchOperations(
  identifier: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchOperationsResult> {
  validateQueryLength(query);
  const session = await getSession(identifier);
  try {
    const regex = `(?i).*${escapeRegex(query)}.*`;

    const countResult = await session.run(
      `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)
       WHERE o.name =~ $regex OR o.description =~ $regex
       RETURN count(o) AS total`,
      { regex }
    );
    const totalCount = toNumber(countResult.records[0]?.get("total"));

    const result = await session.run(
      `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)
       WHERE o.name =~ $regex OR o.description =~ $regex
       OPTIONAL MATCH (o)-[:ACCEPTS]->(p:Parameter)
       OPTIONAL MATCH (o)-[d:DEPRECATED_SINCE]->(v:Version)
       RETURN r.address AS resource,
              o.name AS operation,
              o.description AS description,
              o.stability AS stability,
              collect(CASE WHEN p IS NOT NULL THEN
                {name: p.name, type: p.type, required: p.required}
              END) AS parameters,
              (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince,
              d.reason AS deprecationReason
       ORDER BY o.name, r.address
       LIMIT $limit`,
      { regex, limit: neo4j.int(limit) }
    );

    return {
      results: result.records.map((r) => {
        const op: OperationResult = {
          resource: r.get("resource") as string,
          operation: r.get("operation") as string,
          description: r.get("description") as string,
          parameters: (r.get("parameters") as Array<ParameterInfo | null>).filter(
            (p): p is ParameterInfo => p != null
          ),
        };
        const stability = r.get("stability");
        if (stability != null) op.stability = stability as string;
        const ds = r.get("deprecatedSince");
        if (ds != null) op.deprecatedSince = ds as string;
        const dr = r.get("deprecationReason");
        if (dr != null) op.deprecationReason = dr as string;
        return op;
      }),
      totalCount,
    };
  } finally {
    await session.close();
  }
}
