import { getSession } from "../neo4j.js";

const MAX_ROWS = 100;
const QUERY_TIMEOUT_MS = 10_000;

interface RunCypherResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

export async function runCypher(
  identifier: string,
  query: string
): Promise<RunCypherResult> {
  if (isMutatingQuery(query)) {
    throw new Error(
      "Write operations are not allowed. The model databases are read-only."
    );
  }

  const session = await getSession(identifier);
  try {
    const result = await session.run(query, {}, { timeout: QUERY_TIMEOUT_MS });
    const columns = result.records.length > 0 ? result.records[0].keys : [];
    const truncated = result.records.length > MAX_ROWS;
    const records = result.records.slice(0, MAX_ROWS);

    return {
      columns: columns as string[],
      rows: records.map((r) => {
        const row: Record<string, unknown> = {};
        for (const key of r.keys) {
          const k = String(key);
          row[k] = toPlainValue(r.get(k));
        }
        return row;
      }),
      rowCount: result.records.length,
      truncated,
    };
  } finally {
    await session.close();
  }
}

function isMutatingQuery(query: string): boolean {
  const upper = query.toUpperCase().trim();
  return /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|CALL\s+\{)\b/.test(upper);
}

function toPlainValue(val: unknown): unknown {
  if (val == null) return null;
  if (typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  if (typeof val === "object" && "properties" in val) {
    const node = val as { properties: Record<string, unknown> };
    const plain: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.properties)) {
      plain[k] = toPlainValue(v);
    }
    return plain;
  }
  if (Array.isArray(val)) {
    return val.map(toPlainValue);
  }
  return val;
}
