import type { OrchestrationMessage } from "@t3tools/contracts";

/**
 * Whether a thread's user messages came from more than one person. Clients
 * label user bubbles with the author's name only when this holds, so a solo
 * thread looks exactly as it always has. Messages without an author (persisted
 * before authors were recorded, or synthesized by the server) never count.
 */
export function hasMultipleMessageAuthors(
  messages: Iterable<Pick<OrchestrationMessage, "role" | "author">>,
): boolean {
  let firstAuthorId: string | undefined;
  for (const message of messages) {
    if (message.role !== "user" || message.author === undefined) continue;
    if (firstAuthorId === undefined) {
      firstAuthorId = message.author.id;
    } else if (message.author.id !== firstAuthorId) {
      return true;
    }
  }
  return false;
}
