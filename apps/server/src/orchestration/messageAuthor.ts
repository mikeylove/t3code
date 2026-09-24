import type { AuthClientSession, MessageAuthor } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

/**
 * Sessions the environment owner holds. Their pairing subjects are fixed
 * strings, not per-person identities, so they collapse into one author.
 */
const OWNER_SUBJECTS: ReadonlySet<string> = new Set([
  "desktop-bootstrap",
  "administrative-bootstrap",
]);

/**
 * Pairing links minted without a label share this subject, so it cannot tell
 * two invitees apart.
 */
const ANONYMOUS_SUBJECT = "one-time-token";

/**
 * Derive the author stamped on messages dispatched by an authenticated client
 * session.
 *
 * Identity comes from what a person chose to call themselves, never from a
 * login account: a labeled pairing link ("Clay") names the participant, and
 * every session paired from a link with the same label is the same author. The
 * owner's own devices share one author named by the `ownerDisplayName` setting,
 * falling back to a session label and then to a neutral placeholder until they
 * set one. An unlabeled invite falls back to the session id, so it is at least
 * distinct from everyone else.
 */
export function resolveMessageAuthor(input: {
  readonly session: AuthClientSession;
  readonly ownerName: string | null;
}): MessageAuthor {
  const { session, ownerName } = input;
  const label = session.client.label?.trim();
  if (OWNER_SUBJECTS.has(session.subject)) {
    const chosen = ownerName?.trim();
    const name = chosen && chosen.length > 0 ? chosen : label && label.length > 0 ? label : "Owner";
    return { id: "owner", name, kind: "human" };
  }
  if (label && label.length > 0) {
    return { id: `label:${label.toLowerCase()}`, name: label, kind: "human" };
  }
  if (session.subject !== ANONYMOUS_SUBJECT) {
    return { id: `subject:${session.subject}`, name: session.subject, kind: "human" };
  }
  const deviceName = [session.client.os, session.client.browser].filter(Boolean).join(" ");
  return {
    id: `session:${session.sessionId}`,
    name: deviceName.length > 0 ? deviceName : "Guest",
    kind: "human",
  };
}

/**
 * Prefix a user message for the provider so the agent can tell participants
 * apart. Applied only once a thread has more than one author; solo threads
 * send the text untouched so existing prompts stay byte-identical.
 */
export function formatAuthoredMessageText(input: {
  readonly text: string;
  readonly author: MessageAuthor;
  readonly createdAt: string;
}): string {
  const stamp = Option.match(DateTime.make(input.createdAt), {
    onNone: () => "",
    onSome: (time) => ` · ${DateTime.formatLocal(time, { hour: "numeric", minute: "2-digit" })}`,
  });
  return `[${input.author.name}${stamp}]\n${input.text}`;
}
