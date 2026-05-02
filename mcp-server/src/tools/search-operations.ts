import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";

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
  parameters: ParameterInfo[];
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
       RETURN r.address AS resource,
              o.name AS operation,
              o.description AS description,
              collect(CASE WHEN p IS NOT NULL THEN
                {name: p.name, type: p.type, required: p.required}
              END) AS parameters
       ORDER BY o.name, r.address
       LIMIT $limit`,
      { regex, limit: neo4j.int(limit) }
    );

    return {
      results: result.records.map((r) => ({
        resource: r.get("resource") as string,
        operation: r.get("operation") as string,
        description: r.get("description") as string,
        parameters: (r.get("parameters") as Array<ParameterInfo | null>).filter(
          (p): p is ParameterInfo => p != null
        ),
      })),
      totalCount,
    };
  } finally {
    await session.close();
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return 0;
}
