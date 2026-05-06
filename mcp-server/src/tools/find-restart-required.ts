// Finds attributes that require a server restart after modification.
// Filterable by restart level (no-services, all-services, jvm) and resource address.

import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";
import { escapeRegex, toNumber } from "../utils.js";

const DEFAULT_LIMIT = 50;

interface RestartRequiredEntry {
  resource: string;
  attribute: string;
  type: string;
  restartRequired: string;
  defaultValue?: string;
}

interface FindRestartRequiredResult {
  results: RestartRequiredEntry[];
  totalCount: number;
}

export async function findRestartRequired(
  identifier: string,
  restartType?: string,
  resourceFilter?: string,
  limit: number = DEFAULT_LIMIT
): Promise<FindRestartRequiredResult> {
  const session = await getSession(identifier);
  try {
    const params: Record<string, unknown> = {
      limit: neo4j.int(limit),
    };

    const conditions: string[] = [
      "a.`restart-required` IS NOT NULL",
    ];

    if (restartType) {
      params.restartType = restartType;
      conditions.push("a.`restart-required` = $restartType");
    }
    if (resourceFilter) {
      params.resourceRegex = `(?i).*${escapeRegex(resourceFilter)}.*`;
      conditions.push("r.address =~ $resourceRegex");
    }

    const whereClause = `WHERE ${conditions.join("\n       AND ")}`;

    const countResult = await session.run(
      `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
       ${whereClause}
       RETURN count(a) AS total`,
      params
    );
    const totalCount = toNumber(countResult.records[0]?.get("total"));

    const result = await session.run(
      `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
       ${whereClause}
       RETURN r.address AS resource,
              a.name AS attribute,
              a.type AS type,
              a.\`restart-required\` AS restartRequired,
              a.\`default-value\` AS defaultValue
       ORDER BY a.\`restart-required\`, r.address, a.name
       LIMIT $limit`,
      params
    );

    return {
      results: result.records.map((r) => {
        const entry: RestartRequiredEntry = {
          resource: r.get("resource") as string,
          attribute: r.get("attribute") as string,
          type: r.get("type") as string,
          restartRequired: r.get("restartRequired") as string,
        };
        const dv = r.get("defaultValue");
        if (dv != null) entry.defaultValue = dv as string;
        return entry;
      }),
      totalCount,
    };
  } finally {
    await session.close();
  }
}
