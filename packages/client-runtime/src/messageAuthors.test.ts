import { describe, expect, it } from "@effect/vitest";
import { hasMultipleMessageAuthors } from "./messageAuthors.ts";

const alice = { id: "alice", name: "Alice", kind: "human" as const };
const bob = { id: "bob", name: "Bob", kind: "human" as const };

describe("hasMultipleMessageAuthors", () => {
  it("is false for an empty thread", () => {
    expect(hasMultipleMessageAuthors([])).toBe(false);
  });

  it("is false when every user message shares one author", () => {
    expect(
      hasMultipleMessageAuthors([
        { role: "user", author: alice },
        { role: "assistant" },
        { role: "user", author: alice },
      ]),
    ).toBe(false);
  });

  it("is false when no user message has an author", () => {
    expect(hasMultipleMessageAuthors([{ role: "user" }, { role: "user" }])).toBe(false);
  });

  it("ignores unattributed user messages alongside a single author", () => {
    expect(hasMultipleMessageAuthors([{ role: "user" }, { role: "user", author: alice }])).toBe(
      false,
    );
  });

  it("is true once two distinct author ids appear on user messages", () => {
    expect(
      hasMultipleMessageAuthors([
        { role: "user", author: alice },
        { role: "assistant" },
        { role: "user", author: bob },
      ]),
    ).toBe(true);
  });

  it("only considers user-role messages", () => {
    expect(
      hasMultipleMessageAuthors([
        { role: "user", author: alice },
        { role: "assistant", author: bob },
      ]),
    ).toBe(false);
  });
});
