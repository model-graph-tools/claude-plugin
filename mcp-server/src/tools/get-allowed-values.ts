// Gets allowed values, numeric ranges, and string length constraints for
// attributes and parameters. Searches both element types via UNION ALL.

import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";
import { escapeRegex, toNumber, validateQueryLength } from "../utils.js";

const DEFAULT_LIMIT = 25;

interface AllowedValuesEntry {
  elementType: "attribute" | "parameter";
  name: string;
  resource: string;
  operation?: string;
  type: string;
  allowed?: string[];
  defaultValue?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  unit?: string;
}

interface GetAllowedValuesResult {
  results: AllowedValuesEntry[];
  totalCount: number;
}

export async function getAllowedValues(
  identifier: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<GetAllowedValuesResult> {
  validateQueryLength(query);
  const session = await getSession(identifier);
  try {
    const regex = `(?i).*${escapeRegex(query)}.*`;
    const params = { regex, limit: neo4j.int(limit) };

    const hasConstraint =
      "(a.allowed IS NOT NULL OR a.min IS NOT NULL OR a.max IS NOT NULL " +
      "OR a.`min-length` IS NOT NULL OR a.`max-length` IS NOT NULL)";

    const hasParamConstraint =
      "(p.allowed IS NOT NULL OR p.min IS NOT NULL OR p.max IS NOT NULL " +
      "OR p.`min-length` IS NOT NULL OR p.`max-length` IS NOT NULL)";

    const countResult = await session.run(
      `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
       WHERE (a.name =~ $regex OR a.description =~ $regex) AND ${hasConstraint}
       WITH count(a) AS attrCount
       OPTIONAL MATCH (r2:Resource)-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)
       WHERE (p.name =~ $regex OR p.description =~ $regex) AND ${hasParamConstraint}
       RETURN attrCount + count(p) AS total`,
      { regex }
    );
    const totalCount = toNumber(countResult.records[0]?.get("total"));

    const result = await session.run(
      `MATCH (r:Resource)-[:HAS_ATTRIBUTE]->(a:Attribute)
       WHERE (a.name =~ $regex OR a.description =~ $regex) AND ${hasConstraint}
       RETURN 'attribute' AS elementType,
              a.name AS name, r.address AS resource, null AS operation,
              a.type AS type, a.allowed AS allowed, a.\`default-value\` AS defaultValue,
              a.min AS min, a.max AS max,
              a.\`min-length\` AS minLength, a.\`max-length\` AS maxLength,
              a.unit AS unit
       UNION ALL
       MATCH (r:Resource)-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)
       WHERE (p.name =~ $regex OR p.description =~ $regex) AND ${hasParamConstraint}
       RETURN 'parameter' AS elementType,
              p.name AS name, r.address AS resource, o.name AS operation,
              p.type AS type, p.allowed AS allowed, null AS defaultValue,
              p.min AS min, p.max AS max,
              p.\`min-length\` AS minLength, p.\`max-length\` AS maxLength,
              p.unit AS unit
       ORDER BY name, resource
       LIMIT $limit`,
      params
    );

    return {
      results: result.records.map((r) => {
        const entry: AllowedValuesEntry = {
          elementType: r.get("elementType") as "attribute" | "parameter",
          name: r.get("name") as string,
          resource: r.get("resource") as string,
          type: r.get("type") as string,
        };
        const op = r.get("operation");
        if (op != null) entry.operation = op as string;
        const allowed = r.get("allowed") as string[] | null;
        if (allowed != null && allowed.length > 0) entry.allowed = allowed;
        const dv = r.get("defaultValue");
        if (dv != null) entry.defaultValue = dv as string;
        const min = r.get("min");
        if (min != null) entry.min = toNumber(min);
        const max = r.get("max");
        if (max != null) entry.max = toNumber(max);
        const minLen = r.get("minLength");
        if (minLen != null) entry.minLength = toNumber(minLen);
        const maxLen = r.get("maxLength");
        if (maxLen != null) entry.maxLength = toNumber(maxLen);
        const unit = r.get("unit");
        if (unit != null) entry.unit = unit as string;
        return entry;
      }),
      totalCount,
    };
  } finally {
    await session.close();
  }
}
