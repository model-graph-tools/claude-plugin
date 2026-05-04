import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSession } = vi.hoisted(() => {
  const mockSession = {
    run: vi.fn(),
    close: vi.fn(),
  };
  return { mockSession };
});

vi.mock("../neo4j.js", () => ({
  getSession: vi.fn().mockResolvedValue(mockSession),
}));

import { runCypher } from "./run-cypher.js";

beforeEach(() => {
  vi.clearAllMocks();
});

function mockRecords(keys: string[], rows: unknown[][]) {
  mockSession.run.mockResolvedValue({
    records: rows.map((values) => ({
      keys,
      get: (key: string) => values[keys.indexOf(key)],
    })),
  });
}

describe("runCypher", () => {
  it("returns query results", async () => {
    mockRecords(["name", "count"], [
      ["datasources", 5],
      ["logging", 3],
    ]);

    const result = await runCypher("39.0", "MATCH (n) RETURN n.name AS name, count(*) AS count");
    expect(result.columns).toEqual(["name", "count"]);
    expect(result.rows).toEqual([
      { name: "datasources", count: 5 },
      { name: "logging", count: 3 },
    ]);
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it("returns empty result for no matches", async () => {
    mockRecords([], []);

    const result = await runCypher("39.0", "MATCH (n:Nothing) RETURN n");
    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("truncates results beyond MAX_ROWS", async () => {
    const rows = Array.from({ length: 105 }, (_, i) => [`item${i}`]);
    mockRecords(["name"], rows);

    const result = await runCypher("39.0", "MATCH (n) RETURN n.name AS name");
    expect(result.rows.length).toBe(100);
    expect(result.rowCount).toBe(105);
    expect(result.truncated).toBe(true);
  });

  it("converts Neo4j Integer objects to numbers", async () => {
    mockSession.run.mockResolvedValue({
      records: [{
        keys: ["count"],
        get: () => ({ toNumber: () => 42 }),
      }],
    });

    const result = await runCypher("39.0", "RETURN count(*) AS count");
    expect(result.rows[0].count).toBe(42);
  });

  it("converts Neo4j node objects to plain objects", async () => {
    mockSession.run.mockResolvedValue({
      records: [{
        keys: ["node"],
        get: () => ({ properties: { name: "test", count: { toNumber: () => 7 } } }),
      }],
    });

    const result = await runCypher("39.0", "MATCH (n) RETURN n AS node");
    expect(result.rows[0].node).toEqual({ name: "test", count: 7 });
  });

  it("closes session after successful query", async () => {
    mockRecords(["x"], [["y"]]);
    await runCypher("39.0", "RETURN 'y' AS x");
    expect(mockSession.close).toHaveBeenCalled();
  });

  it("closes session after failed query", async () => {
    mockSession.run.mockRejectedValue(new Error("query error"));
    await expect(runCypher("39.0", "MATCH (n) RETURN n")).rejects.toThrow("query error");
    expect(mockSession.close).toHaveBeenCalled();
  });
});

describe("mutation detection", () => {
  const mutatingQueries = [
    "CREATE (n:Test)",
    "MERGE (n:Test {name: 'foo'})",
    "MATCH (n) DELETE n",
    "MATCH (n) DETACH DELETE n",
    "MATCH (n) SET n.name = 'foo'",
    "MATCH (n) REMOVE n.name",
    "DROP CONSTRAINT foo",
    "FOREACH (x IN [1,2] | CREATE (n))",
    "CALL { CREATE (n:Test) }",
  ];

  for (const query of mutatingQueries) {
    it(`rejects: ${query}`, async () => {
      await expect(runCypher("39.0", query)).rejects.toThrow(
        "Write operations are not allowed"
      );
    });
  }

  it("rejects case-insensitive mutations", async () => {
    await expect(runCypher("39.0", "create (n:Test)")).rejects.toThrow(
      "Write operations are not allowed"
    );
    await expect(runCypher("39.0", "MeRgE (n:Test)")).rejects.toThrow(
      "Write operations are not allowed"
    );
  });

  const readOnlyQueries = [
    "MATCH (n) RETURN n",
    "MATCH (n) WHERE n.name = 'test' RETURN n",
    "MATCH (n)-[r]->(m) RETURN n, r, m",
    "RETURN 1 AS x",
    "MATCH (n) WITH n RETURN count(n)",
    "UNWIND [1,2,3] AS x RETURN x",
  ];

  for (const query of readOnlyQueries) {
    it(`allows: ${query}`, async () => {
      mockRecords(["x"], [["y"]]);
      await expect(runCypher("39.0", query)).resolves.toBeDefined();
    });
  }
});

describe("query length validation", () => {
  it("rejects queries exceeding 10,000 characters", async () => {
    const longQuery = "MATCH " + "a".repeat(10_001);
    await expect(runCypher("39.0", longQuery)).rejects.toThrow(
      "Query too long (max 10000 characters)"
    );
  });

  it("accepts queries within the limit", async () => {
    mockRecords(["x"], [["y"]]);
    const query = "MATCH " + "a".repeat(100);
    await expect(runCypher("39.0", query)).resolves.toBeDefined();
  });
});
