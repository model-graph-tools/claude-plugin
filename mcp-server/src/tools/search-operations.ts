// Searches operations across all resources with optional filters for resource address,
// read-only vs. mutating, and runtime-only. Returns parameters and deprecation info.

import neo4j from "neo4j-driver";
import { getSession } from "../neo4j.js";
import { escapeRegex, pickDefined, toNumber, validateQueryLength } from "../utils.js";

// --- Constants ---

const DEFAULT_LIMIT = 25;

// --- Types ---

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
  global?: boolean;
  readOnly?: boolean;
  runtimeOnly?: boolean;
  returnValue?: string;
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
  resourceFilter?: string,
  readOnly?: boolean,
  runtimeOnly?: boolean,
  limit: number = DEFAULT_LIMIT
): Promise<SearchOperationsResult> {
  if (query) validateQueryLength(query);
  const session = await getSession(identifier);
  try {
    const params: Record<string, unknown> = {
      limit: neo4j.int(limit),
    };

    let whereClause = "";
    const conditions: string[] = [];

    if (query) {
      const regex = `(?i).*${escapeRegex(query)}.*`;
      params.regex = regex;
      conditions.push("(o.name =~ $regex OR o.description =~ $regex)");
    }
    if (resourceFilter) {
      params.resourceRegex = `(?i).*${escapeRegex(resourceFilter)}.*`;
      conditions.push("r.address =~ $resourceRegex");
    }
    if (readOnly !== undefined) {
      params.readOnly = readOnly;
      conditions.push("o.`read-only` = $readOnly");
    }
    if (runtimeOnly !== undefined) {
      params.runtimeOnly = runtimeOnly;
      conditions.push("o.`runtime-only` = $runtimeOnly");
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join("\n       AND ")}`;
    }

    const countResult = await session.run(
      `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)
       ${whereClause}
       RETURN count(o) AS total`,
      params
    );
    const totalCount = toNumber(countResult.records[0]?.get("total"));

    const result = await session.run(
      `MATCH (r:Resource)-[:PROVIDES]->(o:Operation)
       ${whereClause}
       OPTIONAL MATCH (o)-[:ACCEPTS]->(p:Parameter)
       OPTIONAL MATCH (o)-[d:DEPRECATED_SINCE]->(v:Version)
       RETURN r.address AS resource,
              o.name AS operation,
              o.description AS description,
              o.stability AS stability,
              o.global AS global,
              o.\`read-only\` AS readOnly,
              o.\`runtime-only\` AS runtimeOnly,
              o.\`return-value\` AS returnValue,
              collect(CASE WHEN p IS NOT NULL THEN
                {name: p.name, type: p.type, required: p.required}
              END) AS parameters,
              (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince,
              d.reason AS deprecationReason
       ORDER BY o.name, r.address
       LIMIT $limit`,
      params
    );

    return {
      results: result.records.map((r) => ({
        resource: r.get("resource") as string,
        operation: r.get("operation") as string,
        description: r.get("description") as string,
        parameters: (r.get("parameters") as Array<ParameterInfo | null>).filter(
          (p): p is ParameterInfo => p != null
        ),
        ...pickDefined({
          stability: r.get("stability"),
          global: r.get("global"),
          readOnly: r.get("readOnly"),
          runtimeOnly: r.get("runtimeOnly"),
          returnValue: r.get("returnValue"),
          deprecatedSince: r.get("deprecatedSince"),
          deprecationReason: r.get("deprecationReason"),
        }),
      } as OperationResult)),
      totalCount,
    };
  } finally {
    await session.close();
  }
}
