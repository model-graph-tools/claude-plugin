// Escape hatch for running arbitrary read-only Cypher queries.
// Rejects mutating keywords and caps results at 100 rows with a 10s timeout.

import { getSession } from "../neo4j.js";
import { toPlainValue } from "../utils.js";

// --- Constants ---

const MAX_ROWS = 100;
const MAX_QUERY_LENGTH = 10_000;
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
  if (query.length > MAX_QUERY_LENGTH) {
    throw new Error(`Query too long (max ${MAX_QUERY_LENGTH} characters)`);
  }
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
  const normalized = query.normalize("NFKC").toUpperCase().trim();
  return /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|FOREACH|CALL\s*\{)\b/.test(normalized);
}
