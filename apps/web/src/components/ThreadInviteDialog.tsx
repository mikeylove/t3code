import { AuthStandardClientScopes, type ScopedThreadRef } from "@t3tools/contracts";
import { useCallback, useEffect, useId, useState } from "react";
import { create } from "zustand";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { createServerPairingCredential, usePrimarySessionState } from "~/environments/primary";
import { isLocalEnvironmentDisabled } from "~/localEnvironment";
import { desktopNetworkAccessStateAtom } from "~/state/desktopNetworkAccess";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { useUiStateStore } from "~/uiStateStore";
import { canCreateThreadInvite, resolveThreadInviteLink } from "./ThreadInviteDialog.logic";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { QRCodeSvg } from "./ui/qr-code";
import { stackedThreadToast, toastManager } from "./ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

type Request = {
  readonly threadRef: ScopedThreadRef;
  readonly threadTitle: string;
};
const useRequest = create<{ request: Request | null }>(() => ({ request: null }));

/** Opens the invite dialog for a thread. Only one invite dialog is open at a time. */
export function requestThreadInvite(request: Request): void {
  useRequest.setState({ request });
}

function close() {
  useRequest.setState({ request: null });
}

/**
 * Whether the "Invite…" thread action applies to a thread. Reads the primary
 * session once so menu builders can gate per-thread without a hook of their own.
 */
export function useCanInviteToThread(): (threadRef: ScopedThreadRef) => boolean {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const sessionState = usePrimarySessionState();
  const sessionScopes = sessionState.data?.authenticated
    ? (sessionState.data.scopes ?? null)
    : null;
  return useCallback(
    (threadRef) =>
      canCreateThreadInvite({
        isPrimaryEnvironment: threadRef.environmentId === primaryEnvironmentId,
        isDesktopBridge: window.desktopBridge !== undefined,
        sessionScopes,
        localEnvironmentDisabled: isLocalEnvironmentDisabled(),
      }),
    [primaryEnvironmentId, sessionScopes],
  );
}

export function ThreadInviteDialogHost() {
  const request = useRequest((state) => state.request);
  useEffect(() => () => close(), []);
  return request ? <ThreadInviteDialog key={request.threadRef.threadId} request={request} /> : null;
}

function ThreadInviteDialog({ request }: { readonly request: Request }) {
  const id = useId();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [credential, setCredential] = useState<string | null>(null);
  const defaultEndpointKey = useUiStateStore((state) => state.defaultAdvertisedEndpointKey);
  // Only the desktop shell advertises endpoints; the web client pairs against its own origin.
  const networkAccess = useEnvironmentQuery(
    window.desktopBridge !== undefined ? desktopNetworkAccessStateAtom : null,
  );
  const link =
    credential === null
      ? null
      : resolveThreadInviteLink({
          credential,
          endpoints: networkAccess.data?.advertisedEndpoints ?? [],
          defaultEndpointKey,
          currentHref: window.location.href,
        });
  const { copyToClipboard } = useCopyToClipboard({
    target: "invite link",
    onCopy: () => {
      toastManager.add({
        type: "success",
        title: "Invite link copied",
        description: "Send it to the person you want to invite.",
      });
    },
    onError: (error) => {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not copy invite link",
          description: error.message,
        }),
      );
    },
  });

  const handleCreate = async () => {
    const label = name.trim();
    if (!label) return;
    setIsCreating(true);
    try {
      const created = await createServerPairingCredential({
        label,
        threadId: request.threadRef.threadId,
        scopes: AuthStandardClientScopes,
      });
      setCredential(created.credential);
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not create invite",
          description: error instanceof Error ? error.message : "An error occurred.",
        }),
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        {link === null ? (
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Invite to thread</DialogTitle>
              <DialogDescription>
                Share &ldquo;{request.threadTitle}&rdquo; with one other person. They can read and
                reply in this thread only. They can&apos;t see other threads, files, or settings.
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-name`}>Name</Label>
                <Input
                  id={`${id}-name`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Sam"
                  required
                  autoFocus
                  disabled={isCreating}
                />
                <p className="text-xs text-muted-foreground">
                  Shown as the author on their messages.
                </p>
              </div>
            </DialogPanel>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isCreating} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || name.trim() === ""}>
                {isCreating ? "Creating…" : "Create invite"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite ready</DialogTitle>
              <DialogDescription>
                Send this link to {name.trim()}. It works once and expires if unused.
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                        {link.url}
                      </code>
                    }
                  />
                  <TooltipPopup side="top">{link.url}</TooltipPopup>
                </Tooltip>
                <Button
                  size="xs"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => copyToClipboard(link.url, undefined)}
                >
                  Copy link
                </Button>
              </div>
              {link.qrShareable ? (
                <div className="flex justify-center">
                  <div className="w-fit rounded-xl bg-white p-3">
                    <QRCodeSvg
                      value={link.url}
                      size={168}
                      level="M"
                      marginSize={1}
                      title="Invite link — scan to open on another device"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This server only accepts connections from this machine, so the link works in
                  another browser here. Enable network access in Settings → Connections to invite
                  other devices.
                </p>
              )}
            </DialogPanel>
            <DialogFooter>
              <Button type="button" onClick={close}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogPopup>
    </Dialog>
  );
}
