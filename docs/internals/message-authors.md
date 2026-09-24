# Message authors

A thread can be driven by more than one person. Each paired client session belongs to someone,
and the server records who sent every user message so clients and the agent can tell
participants apart. This document covers where that identity comes from and where it flows.

## Where the author is decided

`MessageAuthor` in [`orchestration.ts`][contract] is `{ id, name, kind }` with `kind` either
`human` or `agent`. It is optional on `OrchestrationMessage`, on `ThreadMessageSentPayload`, on
the approval and user-input response payloads, and on the four commands that carry a person's
input: `thread.turn.start`, `thread.message.user.append`, `thread.approval.respond`, and
`thread.user-input.respond`.

Clients never set it. The WebSocket dispatch handler in `ws.ts` stamps it after normalization,
from the authenticated session that carried the command, and overwrites anything a client sent.
Commands the server dispatches on its own behalf carry no author. `resolveMessageAuthor` in
[`messageAuthor.ts`][resolver] maps a session to an author:

- The environment owner's sessions (desktop bootstrap and administrative bootstrap subjects)
  collapse into one author with id `owner`, named by the `ownerDisplayName` server setting
  ("Your name" in Settings). Until it is set, a session label is used, then the placeholder
  `Owner`. The login account is deliberately never consulted: how people name themselves carries
  meaning the machine's username does not.
- A session paired from a labeled pairing link is named by that label, and every session sharing
  the label is the same author. This is how an invitee is identified: mint the link with their
  name.
- An unlabeled invite falls back to the session id so it is at least distinct.

The decider copies `command.author` onto the event payload untouched. The projector and the
persisted projection carry it into `OrchestrationMessage.author` the same way `context` travels,
via a nullable `author_json` column on `projection_thread_messages`.

## What the agent sees

Solo threads send prompts byte-identical to before. A thread counts as shared once its user
messages carry more than one author, or as soon as any author other than the owner appears: the
owner takes part in every thread, so a guest speaking into unattributed history is already a
conversation between two people. `isSharedThreadConversation` in the contract encodes this so the
server's prefix and the clients' labels cannot disagree. In a shared thread the provider reactor
prefixes each message with `[Name · time]` on its own line before handing it to the provider.
Messages persisted before authors were recorded never count as an author, so existing threads do
not start receiving prefixes after an upgrade.

## What clients show

Web and mobile label user bubbles with the author's name only when the thread's user messages
carry two or more distinct author ids, computed once per thread by `hasMultipleMessageAuthors`
in `client-runtime`. Unattributed messages show no label rather than an invented one.

## Thread guests

An invite is a pairing link that names one thread. `AuthCreatePairingCredentialInput.threadId`
travels onto the pairing link row, the consumed bootstrap grant, the issued session row, and
finally `AuthenticatedSession.threadId` on the WebSocket connection and the HTTP principal. A
session carrying it is a **thread guest**. The field is a restriction layered on top of ordinary
delegated scopes, never a grant: scopes are checked first, exactly as for any session.

Enforcement has one chokepoint and a short list of per-handler gates:

- [`RPC_THREAD_GUEST_ACCESS`][rpc-auth] decides every RPC for guests: `denied`, `environment`
  (neutral reads a client needs to connect at all), or `thread`. Like the scope table, it is
  typed against the RPC group, so adding an RPC without choosing is a compile error. The
  `observe*` wrappers in `ws.ts` fail `denied` methods before the handler runs.
- `thread` methods gate themselves. `dispatchCommand` accepts only the conversation commands in
  `THREAD_GUEST_COMMAND_TYPES`, addressed to the guest's thread, and never with a bootstrap.
  `subscribeThread`, the diff queries, worktree setup, and thread-addressed asset URLs compare the
  payload's thread id. `subscribeShell` filters the snapshot, catch-up replay, and live stream to
  the guest's thread and its project.
- The HTTP orchestration snapshot, shell, and dispatch routes and the pull request diff route
  refuse guests; the per-thread snapshot route answers only for the invited thread.

A guest's first ever WebSocket connection appends a `participant.joined` activity to the thread
("Clay joined the thread", tone `info`, no turn) so everyone sees the arrival. Reconnects are
silent: the announcement keys off the session row's `lastConnectedAt` being empty, and it never
reaches the model, which learns who is present from the first prefixed message.

What a guest cannot do is deliberately broad: no lifecycle or mode changes, no files, terminals,
git, previews, devices, settings, other threads, or access management. Loosening any of that is a
one-line change in the table plus a gate, and should be a conscious one.

The web client mirrors the table as **guest mode**. `useThreadGuestScope()`
(`apps/web/src/hooks/useThreadGuest.ts`) reads the guest's thread off the primary session state;
every owner-only surface hides behind its `isGuest`, and `ThreadGuestRouteGuard` in the root route
sends any other page back to the guest's thread. Hide, never disable: a disabled owner control on a
guest's screen is a lie about what the server would allow. Diffs are the one panel a guest keeps:
turn and full-thread diffs are thread reads, so the diff panel (web) and review sheet (mobile) stay,
pinned to turn scope, while the working-tree and branch scopes that need `review.getDiffPreview`
disappear with the rest of the git surface.

## Not yet built

Per-person approval routing (a "voting" gate), presence, guests naming themselves, and surfacing
"approved by" in the timeline are deliberate follow-ups.

[rpc-auth]: ../../apps/server/src/auth/RpcAuthorization.ts
[contract]: ../../packages/contracts/src/orchestration.ts
[resolver]: ../../apps/server/src/orchestration/messageAuthor.ts
