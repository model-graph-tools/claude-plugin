import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

const { mockSession } = vi.hoisted(() => {
  const mockSession = {
    run: vi.fn(),
    close: vi.fn(),
  };
  return { mockSession };
});

vi.mock("../neo4j.js", () => ({
  getSessions: vi.fn((_id: string, count: number) =>
    Promise.resolve(Array.from({ length: count }, () => mockSession)),
  ),
}));

import { findRelationships } from "./find-relationships.js";
import { RELATIONSHIP_SEMANTICS } from "../relationships.js";

beforeEach(() => {
  vi.clearAllMocks();
});

function records(keys: string[], rows: unknown[][]) {
  return {
    records: rows.map((values) => ({
      get: (key: string) => values[keys.indexOf(key)],
    })),
  };
}

describe("findRelationships", () => {
  it("includes the relationship semantics hint when relationships are found", async () => {
    mockSession.run.mockResolvedValueOnce(
      records(
        ["attribute", "requires", "alternatives"],
        [["use-jdbc-store", ["jdbc-store-datasource"], ["use-journal-store"]]],
      ),
    );

    const result = await findRelationships("42.0", "/subsystem=transactions", "attributes");

    expect(result.attributeRelationships).toEqual([
      {
        attribute: "use-jdbc-store",
        requires: ["jdbc-store-datasource"],
        alternatives: ["use-journal-store"],
      },
    ]);
    expect(result.hint).toBe(RELATIONSHIP_SEMANTICS);
  });

  it("omits the hint when no relationships are found", async () => {
    mockSession.run.mockResolvedValue(records([], []));

    const result = await findRelationships("42.0", "/subsystem=logging");

    expect(result.attributeRelationships).toEqual([]);
    expect(result.parameterRelationships).toEqual([]);
    expect(result.hint).toBeUndefined();
  });
});

describe("RELATIONSHIP_SEMANTICS", () => {
  it("explains that switching alternatives requires undefine-attribute", () => {
    expect(RELATIONSHIP_SEMANTICS).toContain("undefine-attribute");
    expect(RELATIONSHIP_SEMANTICS).toContain("WFLYCTL0105");
    expect(RELATIONSHIP_SEMANTICS).toContain("REQUIRES");
  });
});
