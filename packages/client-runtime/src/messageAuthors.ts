import { isSharedThreadConversation, type OrchestrationMessage } from "@t3tools/contracts";

/**
 * Whether clients should label user bubbles with the author's name: only in a
 * shared conversation, so a solo thread looks exactly as it always has. The
 * rule itself lives in contracts beside the author schema so the server's
 * prompt prefix and the clients' labels can never disagree.
 */
export function hasMultipleMessageAuthors(
  messages: Iterable<Pick<OrchestrationMessage, "role" | "author">>,
): boolean {
  return isSharedThreadConversation(messages);
}
