import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockDriver } = vi.hoisted(() => {
  const mockSession = { close: vi.fn() };
  const mockDriver = {
    close: vi.fn().mockResolvedValue(undefined),
    verifyConnectivity: vi.fn().mockResolvedValue(undefined),
    session: vi.fn().mockReturnValue(mockSession),
  };
  return { mockDriver, mockSession };
});

vi.mock("neo4j-driver", () => ({
  default: {
    driver: vi.fn().mockReturnValue(mockDriver),
    session: { READ: "READ" },
  },
}));

import {
  refreshConnection,
  hasConnection,
  getSession,
  getActiveSource,
  closeConnection,
  closeAll,
  setContainerLookup,
  waitForReady,
} from "./neo4j.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockDriver.verifyConnectivity.mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  setContainerLookup(null as never);
});

describe("refreshConnection", () => {
  it("creates a new connection", () => {
    refreshConnection("39.0", 7687);
    expect(hasConnection("39.0")).toBe(true);
  });

  it("closes existing driver when refreshing", () => {
    refreshConnection("39.0", 7687);
    refreshConnection("39.0", 7688);
    expect(mockDriver.close).toHaveBeenCalled();
  });
});

describe("hasConnection", () => {
  it("returns false for unknown identifier", () => {
    expect(hasConnection("unknown")).toBe(false);
  });
});

describe("getSession", () => {
  it("throws when no connection exists", async () => {
    await expect(getSession("nonexistent")).rejects.toThrow(
      'No connection for model graph "nonexistent"'
    );
  });

  it("returns a read-only session", async () => {
    refreshConnection("40.0", 7687);
    await getSession("40.0");
    expect(mockDriver.session).toHaveBeenCalledWith({
      defaultAccessMode: "READ",
    });
  });

  it("verifies connectivity on first call", async () => {
    refreshConnection("40.0", 7687);
    await getSession("40.0");
    expect(mockDriver.verifyConnectivity).toHaveBeenCalled();
  });

  it("skips verification within interval", async () => {
    refreshConnection("41.0", 7687);
    await getSession("41.0");
    mockDriver.verifyConnectivity.mockClear();

    await getSession("41.0");
    expect(mockDriver.verifyConnectivity).not.toHaveBeenCalled();
  });

  it("re-verifies after interval expires", async () => {
    refreshConnection("42.0", 7687);
    await getSession("42.0");
    mockDriver.verifyConnectivity.mockClear();

    vi.advanceTimersByTime(31_000);
    await getSession("42.0");
    expect(mockDriver.verifyConnectivity).toHaveBeenCalled();
  });

  it("sets active source", async () => {
    refreshConnection("43.0", 7687);
    await getSession("43.0");
    expect(getActiveSource()).toBe("43.0");
  });

  it("throws with details when reconnect also fails", async () => {
    refreshConnection("44.0", 7687);
    mockDriver.verifyConnectivity.mockRejectedValue(new Error("connection refused"));

    await expect(getSession("44.0")).rejects.toThrow(
      "connection refused"
    );
  });

  it("auto-connects when container lookup finds running container", async () => {
    const lookup = vi.fn().mockResolvedValue({ bolt: 7687 });
    setContainerLookup(lookup);

    await getSession("50.0");
    expect(lookup).toHaveBeenCalledWith("50.0");
    expect(mockDriver.session).toHaveBeenCalledWith({
      defaultAccessMode: "READ",
    });
  });

  it("throws when container lookup returns null", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    setContainerLookup(lookup);

    await expect(getSession("51.0")).rejects.toThrow(
      'No connection for model graph "51.0"'
    );
    expect(lookup).toHaveBeenCalledWith("51.0");
  });

  it("does not invoke lookup when connection already exists", async () => {
    const lookup = vi.fn().mockResolvedValue({ bolt: 9999 });
    setContainerLookup(lookup);

    refreshConnection("52.0", 7687);
    await getSession("52.0");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("throws when no lookup is set and no connection exists", async () => {
    await expect(getSession("53.0")).rejects.toThrow(
      'No connection for model graph "53.0"'
    );
  });
});

describe("waitForReady", () => {
  it("resolves immediately when connectivity succeeds", async () => {
    refreshConnection("60.0", 7687);
    await waitForReady("60.0");
    expect(mockDriver.verifyConnectivity).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds on later attempt", async () => {
    refreshConnection("61.0", 7687);
    mockDriver.verifyConnectivity
      .mockRejectedValueOnce(new Error("not ready"))
      .mockRejectedValueOnce(new Error("not ready"))
      .mockResolvedValueOnce(undefined);

    const promise = waitForReady("61.0", 3);
    // Advance past the first two delays (500ms, 1000ms)
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(mockDriver.verifyConnectivity).toHaveBeenCalledTimes(3);
  });

  it("throws after all attempts exhausted", async () => {
    vi.useRealTimers();
    refreshConnection("62.0", 7687);
    mockDriver.verifyConnectivity.mockRejectedValue(new Error("connection refused"));

    await expect(waitForReady("62.0", 1)).rejects.toThrow(
      'Model graph "62.0" started but Neo4j is not ready after 1 attempts'
    );

    vi.useFakeTimers();
  });

  it("throws when no connection exists", async () => {
    await expect(waitForReady("nonexistent")).rejects.toThrow(
      'No connection for "nonexistent" to verify'
    );
  });
});

describe("closeConnection", () => {
  it("removes connection and clears active source", async () => {
    refreshConnection("45.0", 7687);
    await getSession("45.0");
    expect(getActiveSource()).toBe("45.0");

    await closeConnection("45.0");
    expect(hasConnection("45.0")).toBe(false);
    expect(getActiveSource()).toBeNull();
  });

  it("is a no-op for unknown identifiers", async () => {
    await expect(closeConnection("unknown")).resolves.toBeUndefined();
  });
});

describe("closeAll", () => {
  it("closes all connections", async () => {
    refreshConnection("46.0", 7687);
    refreshConnection("47.0", 7688);

    await closeAll();
    expect(hasConnection("46.0")).toBe(false);
    expect(hasConnection("47.0")).toBe(false);
  });
});
