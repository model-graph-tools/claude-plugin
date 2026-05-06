// Shared utilities for Cypher query building and Neo4j result mapping.

// --- Constants ---

const MAX_QUERY_LENGTH = 200;

// --- String utilities ---

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Neo4j value conversion ---
// Neo4j integers are returned as objects with a toNumber() method, not plain JS numbers.

export function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return 0;
}

export function toNumberOrUndefined(val: unknown): number | undefined {
  if (val == null) return undefined;
  return toNumber(val);
}

export function validateQueryLength(query: string): void {
  if (query.length > MAX_QUERY_LENGTH) {
    throw new Error(
      `Search query too long (max ${MAX_QUERY_LENGTH} characters)`
    );
  }
}

// --- Output formatting ---

export function pickDefined(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => {
      if (v == null) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    })
  );
}

export function toPlainValue(val: unknown): unknown {
  if (val == null) return null;
  if (typeof val === "object" && "toNumber" in val) {
    return toNumber(val);
  }
  if (typeof val === "object" && "properties" in val) {
    const node = val as { properties: Record<string, unknown> };
    return Object.fromEntries(
      Object.entries(node.properties).map(([k, v]) => [k, toPlainValue(v)])
    );
  }
  if (Array.isArray(val)) {
    return val.map(toPlainValue);
  }
  return val;
}
