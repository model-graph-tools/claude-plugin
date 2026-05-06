// Discovers attribute groups — logical groupings of related attributes within resources.

import { getSession } from "../neo4j.js";
import { escapeRegex } from "../utils.js";

interface AttributeGroupEntry {
  resource: string;
  group: string;
  attributes: string[];
}

export async function findAttributeGroups(
  identifier: string,
  resource?: string,
  groupName?: string
): Promise<AttributeGroupEntry[]> {
  const session = await getSession(identifier);
  try {
    const params: Record<string, unknown> = {};
    const conditions: string[] = [
      "a.`attribute-group` IS NOT NULL",
    ];

    if (resource) {
      params.address = resource;
      conditions.push("r.address = $address");
    }
    if (groupName) {
      params.groupRegex = `(?i).*${escapeRegex(groupName)}.*`;
      conditions.push("a.`attribute-group` =~ $groupRegex");
    }

    const whereClause = `WHERE ${conditions.join("\n       AND ")}`;

    const result = await session.run(
      `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
       ${whereClause}
       RETURN r.address AS resource,
              a.\`attribute-group\` AS group,
              collect(a.name) AS attributes
       ORDER BY r.address, group`,
      params
    );

    return result.records.map((r) => ({
      resource: r.get("resource") as string,
      group: r.get("group") as string,
      attributes: r.get("attributes") as string[],
    }));
  } finally {
    await session.close();
  }
}
