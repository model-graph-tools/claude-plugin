// Resolves user-provided identifiers (e.g. "39", "ai:0.9.1") to canonical
// identifiers via `mgt resolve`. Handles both single and paired lookups.

import { runMgt } from "./mgt.js";

interface ResolveResult {
  identifier: string;
  source_type: string;
  name: string;
}

export async function resolveIdentifier(input: string): Promise<string> {
  const results = await mgtResolve(input);
  return results[0].identifier;
}

export async function resolveIdentifiers(
  id1: string,
  id2: string
): Promise<[string, string]> {
  const results = await mgtResolve(`${id1},${id2}`);
  return [results[0].identifier, results[1].identifier];
}

async function mgtResolve(input: string): Promise<ResolveResult[]> {
  const output = await runMgt(["resolve", input]);
  const results = JSON.parse(output) as ResolveResult[];
  if (results.length === 0) {
    throw new Error(`Could not resolve identifier "${input}"`);
  }
  return results;
}
