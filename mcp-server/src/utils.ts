const MAX_QUERY_LENGTH = 200;

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return 0;
}

export function validateQueryLength(query: string): void {
  if (query.length > MAX_QUERY_LENGTH) {
    throw new Error(
      `Search query too long (max ${MAX_QUERY_LENGTH} characters)`
    );
  }
}
