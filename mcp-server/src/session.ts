// Tracks which model graphs were started during this MCP session
// so they can be stopped during graceful shutdown.

const startedBySession = new Set<string>();

export function trackStarted(identifier: string): void {
  startedBySession.add(identifier);
}

export function untrackStarted(identifier: string): void {
  startedBySession.delete(identifier);
}

export function getStartedBySession(): ReadonlySet<string> {
  return startedBySession;
}
