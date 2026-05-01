import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";

const DEFAULT_LIMIT = 25;

interface AttributeResult {
  resource: string;
  name: string;
  type: string;
  description: string;
  deprecatedSince?: string;
  deprecationReason?: string;
}

interface SearchAttributesResult {
  results: AttributeResult[];
  totalCount: number;
}

export async function searchAttributes(
  identifier: string,
  query: string,
  deprecated?: boolean,
  stability?: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchAttributesResult> {
  const session = getSession(identifier);
  try {
    const regex = `(?i).*${escapeRegex(query)}.*`;
    const params: Record<string, unknown> = { regex, limit: neo4j.int(limit) };

    let whereClause = `WHERE (a.name =~ $regex OR a.description =~ $regex)`;
    if (stability) {
      whereClause += `\nAND a.stability = $stability`;
      params.stability = stability;
    }

    const deprecatedJoin = deprecated
      ? `MATCH (a)-[d:DEPRECATED_SINCE]->(v:Version)`
      : `OPTIONAL MATCH (a)-[d:DEPRECATED_SINCE]->(v:Version)`;

    const baseQuery = `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
       ${whereClause}
       ${deprecatedJoin}`;

    const countResult = await session.run(
      `${baseQuery}\nRETURN count(a) AS total`,
      params
    );
    const totalCount = toNumber(countResult.records[0]?.get("total"));

    const result = await session.run(
      `${baseQuery}
       RETURN r.address AS resource,
              a.name AS name,
              a.type AS type,
              a.description AS description,
              v.name AS deprecatedSince,
              d.reason AS deprecationReason
       ORDER BY a.name, r.address
       LIMIT $limit`,
      params
    );

    return {
      results: result.records.map(mapRecord),
      totalCount,
    };
  } finally {
    await session.close();
  }
}

function mapRecord(r: { get(key: string): unknown }): AttributeResult {
  const attr: AttributeResult = {
    resource: r.get("resource") as string,
    name: r.get("name") as string,
    type: r.get("type") as string,
    description: r.get("description") as string,
  };
  const ds = r.get("deprecatedSince");
  if (ds != null) attr.deprecatedSince = ds as string;
  const dr = r.get("deprecationReason");
  if (dr != null) attr.deprecationReason = dr as string;
  return attr;
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
