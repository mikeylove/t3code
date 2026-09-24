import { OWNER_MESSAGE_AUTHOR_ID } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import { hasMultipleMessageAuthors } from "./messageAuthors.ts";

const owner = { id: OWNER_MESSAGE_AUTHOR_ID, name: "Mikey", kind: "human" as const };
const clay = { id: "label:clay", name: "Clay", kind: "human" as const };
const dave = { id: "label:dave", name: "Dave", kind: "human" as const };

describe("hasMultipleMessageAuthors", () => {
  it("is false for an empty thread", () => {
    expect(hasMultipleMessageAuthors([])).toBe(false);
  });

  it("is false when the owner is the only author", () => {
    expect(
      hasMultipleMessageAuthors([
        { role: "user", author: owner },
        { role: "assistant" },
        { role: "user", author: owner },
      ]),
    ).toBe(false);
  });

  it("is false when no user message has an author", () => {
    expect(hasMultipleMessageAuthors([{ role: "user" }, { role: "user" }])).toBe(false);
  });

  it("ignores unattributed history beside the owner", () => {
    expect(hasMultipleMessageAuthors([{ role: "user" }, { role: "user", author: owner }])).toBe(
      false,
    );
  });

  it("is true as soon as a guest speaks, even into unattributed history", () => {
    expect(hasMultipleMessageAuthors([{ role: "user" }, { role: "user", author: clay }])).toBe(
      true,
    );
  });

  it("is true once two distinct authors appear on user messages", () => {
    expect(
      hasMultipleMessageAuthors([
        { role: "user", author: owner },
        { role: "assistant" },
        { role: "user", author: clay },
      ]),
    ).toBe(true);
    expect(
      hasMultipleMessageAuthors([
        { role: "user", author: clay },
        { role: "user", author: dave },
      ]),
    ).toBe(true);
  });

  it("only considers user-role messages", () => {
    expect(
      hasMultipleMessageAuthors([
        { role: "user", author: owner },
        { role: "assistant", author: clay },
      ]),
    ).toBe(false);
  });
});
