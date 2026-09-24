import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useMemo } from "react";

import { usePrimarySessionState } from "../environments/primary";
import { usePrimaryEnvironmentId } from "../state/environments";

/**
 * Whether this client is a thread guest: a session paired from a thread
 * invite, which the server confines to conversation on one thread (see
 * RPC_THREAD_GUEST_ACCESS). Owner-only controls and routes hide behind
 * `isGuest`; `threadRef` is the one thread the guest may see, once the
 * primary environment is known. Reads false while the session is still
 * loading, so owners never see a guest flash; the server denies anything a
 * guest reaches in that window regardless.
 */
export function useThreadGuestScope(): {
  readonly isGuest: boolean;
  readonly threadRef: ScopedThreadRef | null;
} {
  const guestThreadId = usePrimarySessionState().data?.threadId;
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  return useMemo(
    () => ({
      isGuest: guestThreadId !== undefined,
      threadRef:
        guestThreadId !== undefined && primaryEnvironmentId !== null
          ? scopeThreadRef(primaryEnvironmentId, guestThreadId)
          : null,
    }),
    [guestThreadId, primaryEnvironmentId],
  );
}
