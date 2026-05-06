// Finds attributes marked as security-sensitive via IS_SENSITIVE relationships
// to Constraint nodes. Useful for auditing passwords, keys, and secrets.

import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";
import { escapeRegex, toNumber, validateQueryLength } from "../utils.js";

const DEFAULT_LIMIT = 50;

interface SensitiveAttribute {
  resource: string;
  attribute: string;
  type: string;
  constraint: string;
  constraintType: string;
}

interface FindSensitiveResult {
  results: SensitiveAttribute[];
  totalCount: number;
}

export async function findSensitiveAttributes(
  identifier: string,
  query?: string,
  limit: number = DEFAULT_LIMIT
): Promise<FindSensitiveResult> {
  if (query) validateQueryLength(query);
  const session = await getSession(identifier);
  try {
    const params: Record<string, unknown> = {
      limit: neo4j.int(limit),
    };

    let whereClause = "";
    if (query) {
      const regex = `(?i).*${escapeRegex(query)}.*`;
      params.regex = regex;
      whereClause = "WHERE a.name =~ $regex OR r.address =~ $regex";
    }

    const countResult = await session.run(
      `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)-[:IS_SENSITIVE]->(c:Constraint)
       ${whereClause}
       RETURN count(a) AS total`,
      params
    );
    const totalCount = toNumber(countResult.records[0]?.get("total"));

    const result = await session.run(
      `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)-[:IS_SENSITIVE]->(c:Constraint)
       ${whereClause}
       RETURN r.address AS resource,
              a.name AS attribute,
              a.type AS type,
              c.name AS constraint,
              c.type AS constraintType
       ORDER BY r.address, a.name
       LIMIT $limit`,
      params
    );

    return {
      results: result.records.map((r) => ({
        resource: r.get("resource") as string,
        attribute: r.get("attribute") as string,
        type: r.get("type") as string,
        constraint: r.get("constraint") as string,
        constraintType: r.get("constraintType") as string,
      })),
      totalCount,
    };
  } finally {
    await session.close();
  }
}
