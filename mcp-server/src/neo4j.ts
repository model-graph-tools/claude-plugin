// Connection pool for Neo4j model graph databases.
// Each WildFly version/feature pack runs in its own Neo4j container.
// This module maps identifiers to Bolt drivers and periodically re-verifies connectivity.

import neo4j, { type Driver, type Session } from "neo4j-driver";

// --- Types ---

interface ConnectionEntry {
  driver: Driver;
  boltPort: number;
}

// --- Types ---

type ContainerLookup = (identifier: string) => Promise<{ bolt: number } | null>;

// --- State ---

// Re-verify connectivity after this interval to detect containers that stopped
const VERIFY_INTERVAL_MS = 30_000;
const READINESS_DELAYS = [500, 1000, 2000, 4000, 8000];
const connections = new Map<string, ConnectionEntry>();
const lastVerified = new Map<string, number>();
// Tracks the most recently used model graph for session continuity
let activeSource: string | null = null;
let findRunningContainer: ContainerLookup | null = null;

export function setContainerLookup(fn: ContainerLookup): void {
  findRunningContainer = fn;
}

// --- Connection lifecycle ---

function createDriver(boltPort: number): Driver {
  return neo4j.driver(`bolt://localhost:${boltPort}`, undefined, {
    maxConnectionPoolSize: 10,
    connectionAcquisitionTimeout: 5000,
  });
}

export function refreshConnection(identifier: string, boltPort: number): Driver {
  const existing = connections.get(identifier);
  if (existing) {
    existing.driver.close().catch((err) => {
      console.error(`Failed to close driver for ${identifier}:`, err);
    });
  }
  lastVerified.delete(identifier);
  const driver = createDriver(boltPort);
  connections.set(identifier, { driver, boltPort });
  return driver;
}

export function hasConnection(identifier: string): boolean {
  return connections.has(identifier);
}

// --- Session access ---

export async function getSession(identifier: string): Promise<Session> {
  let entry = connections.get(identifier);
  if (!entry) {
    if (findRunningContainer) {
      const container = await findRunningContainer(identifier);
      if (container) {
        const driver = createDriver(container.bolt);
        entry = { driver, boltPort: container.bolt };
        connections.set(identifier, entry);
      }
    }
    if (!entry) {
      throw new Error(
        `No connection for model graph "${identifier}". Use start_source to start it first.`
      );
    }
  }

  const now = Date.now();
  const lastCheck = lastVerified.get(identifier) ?? 0;
  if (now - lastCheck > VERIFY_INTERVAL_MS) {
    try {
      await entry.driver.verifyConnectivity();
      lastVerified.set(identifier, now);
    } catch (verifyError) {
      console.error(`Connection verification failed for ${identifier}, attempting reconnect:`, verifyError);
      entry.driver.close().catch((err) => {
        console.error(`Failed to close stale driver for ${identifier}:`, err);
      });
      const freshDriver = createDriver(entry.boltPort);
      connections.set(identifier, { driver: freshDriver, boltPort: entry.boltPort });
      try {
        await freshDriver.verifyConnectivity();
        lastVerified.set(identifier, Date.now());
      } catch (reconnectError) {
        connections.delete(identifier);
        lastVerified.delete(identifier);
        const detail = reconnectError instanceof Error ? reconnectError.message : String(reconnectError);
        throw new Error(
          `Cannot connect to model graph "${identifier}" at bolt://localhost:${entry.boltPort}: ${detail}. ` +
            `The container may not be running or Neo4j may not be ready. Use start_source to reconnect.`
        );
      }
    }
  }

  activeSource = identifier;
  return connections.get(identifier)!.driver.session({
    defaultAccessMode: neo4j.session.READ,
  });
}

export function getActiveSource(): string | null {
  return activeSource;
}

export function ensureConnection(identifier: string, boltPort: number): void {
  const existing = connections.get(identifier);
  if (!existing || existing.boltPort !== boltPort) {
    refreshConnection(identifier, boltPort);
  }
}

export async function getSessions(identifier: string, count: number): Promise<Session[]> {
  const first = await getSession(identifier);
  if (count <= 1) return [first];

  const entry = connections.get(identifier)!;
  const rest = Array.from({ length: count - 1 }, () =>
    entry.driver.session({ defaultAccessMode: neo4j.session.READ })
  );
  return [first, ...rest];
}

// --- Readiness ---

export async function waitForReady(
  identifier: string,
  maxAttempts: number = READINESS_DELAYS.length
): Promise<void> {
  const entry = connections.get(identifier);
  if (!entry) {
    throw new Error(`No connection for "${identifier}" to verify`);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await entry.driver.verifyConnectivity();
      lastVerified.set(identifier, Date.now());
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, READINESS_DELAYS[attempt]));
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Model graph "${identifier}" started but Neo4j is not ready after ${maxAttempts} attempts: ${detail}. ` +
      `The database may still be loading. Try again in a few seconds.`
  );
}

// --- Cleanup ---

export async function closeConnection(identifier: string): Promise<void> {
  const entry = connections.get(identifier);
  if (entry) {
    await entry.driver.close();
    connections.delete(identifier);
    lastVerified.delete(identifier);
    if (activeSource === identifier) {
      activeSource = null;
    }
  }
}

export async function closeAll(): Promise<void> {
  const closePromises = Array.from(connections.values()).map((e) =>
    e.driver.close()
  );
  await Promise.all(closePromises);
  connections.clear();
  lastVerified.clear();
}
