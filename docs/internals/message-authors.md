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

Solo threads send prompts byte-identical to before. When the turn-start query reports that the
thread contains user messages from another author, the provider reactor prefixes the message with
`[Name · time]` on its own line before handing it to the provider. Messages persisted before
authors were recorded never count as another author, so existing threads do not start receiving
prefixes after an upgrade.

## What clients show

Web and mobile label user bubbles with the author's name only when the thread's user messages
carry two or more distinct author ids, computed once per thread by `hasMultipleMessageAuthors`
in `client-runtime`. Unattributed messages show no label rather than an invented one.

## Not yet built

Sessions are still environment-wide: an invitee sees every project and thread the pairing link's
scopes allow. A thread-scoped session grant, per-person approval routing, and presence are
deliberate follow-ups.

[contract]: ../../packages/contracts/src/orchestration.ts
[resolver]: ../../apps/server/src/orchestration/messageAuthor.ts
