import { describe, it, expect } from "vitest";
import { escapeRegex, toNumber, validateQueryLength } from "./utils.js";

describe("escapeRegex", () => {
  it("escapes special regex characters", () => {
    expect(escapeRegex("foo.bar")).toBe("foo\\.bar");
    expect(escapeRegex("a+b*c?")).toBe("a\\+b\\*c\\?");
    expect(escapeRegex("(test)")).toBe("\\(test\\)");
    expect(escapeRegex("[abc]")).toBe("\\[abc\\]");
    expect(escapeRegex("a{2}")).toBe("a\\{2\\}");
    expect(escapeRegex("a|b")).toBe("a\\|b");
    expect(escapeRegex("^start$")).toBe("\\^start\\$");
    expect(escapeRegex("path\\to")).toBe("path\\\\to");
  });

  it("leaves plain strings unchanged", () => {
    expect(escapeRegex("hello")).toBe("hello");
    expect(escapeRegex("foo-bar_baz")).toBe("foo-bar_baz");
    expect(escapeRegex("")).toBe("");
  });

  it("escapes all special characters in a single string", () => {
    expect(escapeRegex(".*+?^${}()|[]\\")).toBe(
      "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\"
    );
  });
});

describe("toNumber", () => {
  it("returns number values as-is", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-1)).toBe(-1);
    expect(toNumber(3.14)).toBe(3.14);
  });

  it("calls toNumber() on Neo4j Integer-like objects", () => {
    const neo4jInt = { toNumber: () => 99 };
    expect(toNumber(neo4jInt)).toBe(99);
  });

  it("returns 0 for null and undefined", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it("returns 0 for non-numeric types", () => {
    expect(toNumber("42")).toBe(0);
    expect(toNumber(true)).toBe(0);
    expect(toNumber({})).toBe(0);
    expect(toNumber([])).toBe(0);
  });
});

describe("validateQueryLength", () => {
  it("accepts queries within the limit", () => {
    expect(() => validateQueryLength("short query")).not.toThrow();
    expect(() => validateQueryLength("a".repeat(200))).not.toThrow();
  });

  it("rejects queries exceeding the limit", () => {
    expect(() => validateQueryLength("a".repeat(201))).toThrow(
      "Search query too long (max 200 characters)"
    );
  });

  it("accepts empty queries", () => {
    expect(() => validateQueryLength("")).not.toThrow();
  });
});
