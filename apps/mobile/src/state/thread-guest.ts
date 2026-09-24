import { useAtomValue } from "@effect/atom-react";
import { StackActions, useNavigation } from "@react-navigation/native";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { Atom } from "effect/unstable/reactivity";
import { useEffect } from "react";

import { environmentCatalog } from "../connection/catalog";
import { environmentSession } from "./session";

/**
 * A thread guest is a session paired from a thread invite. The server confines
 * it to conversation on one thread and reports that thread on
 * `/api/auth/session` (`AuthSessionState.threadId`), which the per-environment
 * session state atom already fetches. Null for owners and until the session
 * state has loaded, so owner chrome never hides behind a pending fetch.
 */
export const guestThreadIdAtom = Atom.family((environmentId: EnvironmentId) =>
  Atom.make(
    (get): ThreadId | null =>
      get(environmentSession.sessionStateValueAtom(environmentId))?.threadId ?? null,
  ).pipe(Atom.withLabel(`mobile-thread-guest:${environmentId}`)),
);

const NO_GUEST_THREAD_ATOM = Atom.make<ThreadId | null>(null).pipe(
  Atom.withLabel("mobile-thread-guest:none"),
);

/** The one thread this client may see on an environment, or null when it is an owner there. */
export function useGuestThreadId(environmentId: EnvironmentId | null): ThreadId | null {
  return useAtomValue(
    environmentId === null ? NO_GUEST_THREAD_ATOM : guestThreadIdAtom(environmentId),
  );
}

/** Guest thread per saved environment; owner environments are absent. */
export const guestThreadIdsAtom = Atom.make((get): ReadonlyMap<EnvironmentId, ThreadId> => {
  const guests = new Map<EnvironmentId, ThreadId>();
  for (const environmentId of get(environmentCatalog.catalogValueAtom).entries.keys()) {
    const threadId = get(guestThreadIdAtom(environmentId));
    if (threadId !== null) {
      guests.set(environmentId, threadId);
    }
  }
  return guests;
}).pipe(Atom.withLabel("mobile-thread-guest:all"));

export function useGuestThreadIds(): ReadonlyMap<EnvironmentId, ThreadId> {
  return useAtomValue(guestThreadIdsAtom);
}

/** Every saved environment is a guest session, so nothing on this device can start a task. */
const guestOnlyEnvironmentsAtom = Atom.make((get): boolean => {
  const environmentIds = [...get(environmentCatalog.catalogValueAtom).entries.keys()];
  const guests = get(guestThreadIdsAtom);
  return (
    environmentIds.length > 0 && environmentIds.every((environmentId) => guests.has(environmentId))
  );
}).pipe(Atom.withLabel("mobile-thread-guest:only"));

export function useGuestOnlyEnvironments(): boolean {
  return useAtomValue(guestOnlyEnvironmentsAtom);
}

/**
 * Sends a guest who deep-linked into an owner-only thread route (terminal,
 * files, git, review, devices) back to where they came from. Entry points are
 * hidden for guests, so only a stale link reaches these screens.
 */
export function useGuestRouteGuard(environmentId: EnvironmentId | null) {
  const navigation = useNavigation();
  const guestThreadId = useGuestThreadId(environmentId);
  useEffect(() => {
    if (environmentId === null || guestThreadId === null) {
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.dispatch(
      StackActions.replace("Thread", {
        environmentId: String(environmentId),
        threadId: String(guestThreadId),
      }),
    );
  }, [environmentId, guestThreadId, navigation]);
  return guestThreadId !== null;
}
