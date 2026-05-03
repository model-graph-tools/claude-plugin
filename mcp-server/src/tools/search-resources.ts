import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";

const DEFAULT_LIMIT = 25;

interface ResourceResult {
  address: string;
  name: string;
  description: string;
  singleton: boolean;
  childCount: number;
}

interface SearchResourcesResult {
  results: ResourceResult[];
  totalCount: number;
}

export async function searchResources(
  identifier: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchResourcesResult> {
  const session = await getSession(identifier);
  try {
    const regex = `(?i).*${escapeRegex(query)}.*`;

    const countResult = await session.run(
      `MATCH (r:Resource)
       WHERE r.name =~ $regex OR r.address =~ $regex OR r.description =~ $regex
       RETURN count(r) AS total`,
      { regex }
    );
    const totalCount = (countResult.records[0]?.get("total") as { toNumber(): number }).toNumber();

    const result = await session.run(
      `MATCH (r:Resource)
       WHERE r.name =~ $regex OR r.address =~ $regex OR r.description =~ $regex
       OPTIONAL MATCH (child:Resource)-[:CHILD_OF]->(r)
       RETURN r.address AS address,
              r.name AS name,
              r.description AS description,
              r.singleton AS singleton,
              count(child) AS childCount
       ORDER BY r.address
       LIMIT $limit`,
      { regex, limit: neo4j.int(limit) }
    );

    return {
      results: result.records.map((r) => ({
        address: r.get("address") as string,
        name: r.get("name") as string,
        description: r.get("description") as string,
        singleton: (r.get("singleton") as boolean) ?? false,
        childCount: toNumber(r.get("childCount")),
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
