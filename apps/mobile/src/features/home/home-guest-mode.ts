import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";

export interface HomeGuestMode {
  /**
   * Every environment in scope is a thread guest session, so the list holds
   * nothing but guest threads: no new task, search, or project actions.
   */
  readonly guestOnly: boolean;
  /** The single guest thread the list should land on, when there is exactly one. */
  readonly landingThread: ScopedThreadRef | null;
}

/**
 * Home lists threads across every saved environment, optionally narrowed to
 * one. Owner chrome hides only when nothing in scope belongs to an owner, so a
 * user who is an owner on one machine and a guest on another keeps their
 * owner tools.
 */
export function resolveHomeGuestMode(input: {
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly environmentIds: ReadonlyArray<EnvironmentId>;
  readonly guestThreadIds: ReadonlyMap<EnvironmentId, ThreadId>;
}): HomeGuestMode {
  const scope =
    input.selectedEnvironmentId === null ? input.environmentIds : [input.selectedEnvironmentId];
  const guestOnly =
    scope.length > 0 && scope.every((environmentId) => input.guestThreadIds.has(environmentId));
  const landingEnvironmentId = guestOnly && scope.length === 1 ? scope[0]! : null;
  const landingThreadId =
    landingEnvironmentId === null ? undefined : input.guestThreadIds.get(landingEnvironmentId);
  return {
    guestOnly,
    landingThread:
      landingEnvironmentId !== null && landingThreadId !== undefined
        ? { environmentId: landingEnvironmentId, threadId: landingThreadId }
        : null,
  };
}

/** Environments whose thread search the server would refuse: guests may not search. */
export function excludeGuestEnvironments(
  environmentIds: ReadonlyArray<EnvironmentId>,
  guestThreadIds: ReadonlyMap<EnvironmentId, ThreadId>,
): ReadonlyArray<EnvironmentId> {
  return guestThreadIds.size === 0
    ? environmentIds
    : environmentIds.filter((environmentId) => !guestThreadIds.has(environmentId));
}
