import { AuthSessionId, type AuthClientSession } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  formatAuthoredMessageText,
  resolveMessageAuthor,
  shouldNameSpeaker,
} from "./messageAuthor.ts";

const session = (overrides: Partial<AuthClientSession> = {}): AuthClientSession => ({
  sessionId: AuthSessionId.make("session-1"),
  subject: "one-time-token",
  scopes: ["orchestration:read", "orchestration:operate"],
  method: "browser-session-cookie",
  client: { deviceType: "desktop" },
  issuedAt: DateTime.makeUnsafe("2026-09-24T10:00:00.000Z"),
  expiresAt: DateTime.makeUnsafe("2026-10-24T10:00:00.000Z"),
  lastConnectedAt: null,
  connected: true,
  current: true,
  ...overrides,
});

describe("resolveMessageAuthor", () => {
  it("collapses every owner device into one author named by the display name setting", () => {
    const desktop = resolveMessageAuthor({
      session: session({ subject: "desktop-bootstrap" }),
      ownerName: "Michael",
    });
    const admin = resolveMessageAuthor({
      session: session({
        subject: "administrative-bootstrap",
        sessionId: AuthSessionId.make("s2"),
      }),
      ownerName: "Michael",
    });
    expect(desktop).toEqual({ id: "owner", name: "Michael", kind: "human" });
    expect(admin.id).toBe(desktop.id);
  });

  it("uses a neutral placeholder for the owner until they choose a name", () => {
    expect(
      resolveMessageAuthor({ session: session({ subject: "desktop-bootstrap" }), ownerName: null }),
    ).toEqual({ id: "owner", name: "Owner", kind: "human" });
    expect(
      resolveMessageAuthor({
        session: session({
          subject: "desktop-bootstrap",
          client: { deviceType: "desktop", label: "Studio Mac" },
        }),
        ownerName: null,
      }).name,
    ).toBe("Studio Mac");
  });

  it("names an invitee from the pairing label and keys identity on it", () => {
    const laptop = resolveMessageAuthor({
      session: session({ client: { deviceType: "desktop", label: "Clay" } }),
      ownerName: "mike",
    });
    const phone = resolveMessageAuthor({
      session: session({
        sessionId: AuthSessionId.make("s3"),
        client: { deviceType: "mobile", label: "clay " },
      }),
      ownerName: "mike",
    });
    expect(laptop).toEqual({ id: "label:clay", name: "Clay", kind: "human" });
    expect(phone.id).toBe(laptop.id);
  });

  it("falls back to the session for an unlabeled invite so it stays distinct", () => {
    const author = resolveMessageAuthor({
      session: session({ client: { deviceType: "mobile", os: "iOS", browser: "Safari" } }),
      ownerName: "mike",
    });
    expect(author).toEqual({ id: "session:session-1", name: "iOS Safari", kind: "human" });
  });
});

describe("shouldNameSpeaker", () => {
  const owner = { id: "owner", name: "Mikey", kind: "human" as const };
  const clay = { id: "label:clay", name: "Clay", kind: "human" as const };

  it("keeps a solo owner thread untouched", () => {
    expect(shouldNameSpeaker({ author: owner, hasOtherAuthors: false })).toBe(false);
    expect(shouldNameSpeaker({ author: undefined, hasOtherAuthors: false })).toBe(false);
  });

  it("names the owner once someone else has spoken", () => {
    expect(shouldNameSpeaker({ author: owner, hasOtherAuthors: true })).toBe(true);
  });

  it("always names a guest, even as the first attributed message in an old thread", () => {
    expect(shouldNameSpeaker({ author: clay, hasOtherAuthors: false })).toBe(true);
  });
});

describe("formatAuthoredMessageText", () => {
  it("leads with the author name and keeps the body intact", () => {
    const text = formatAuthoredMessageText({
      text: "please rerun the tests\nthen ship",
      author: { id: "label:clay", name: "Clay", kind: "human" },
      createdAt: "2026-09-24T10:16:00.000Z",
    });
    expect(text.startsWith("[Clay · ")).toBe(true);
    expect(text.endsWith("]\nplease rerun the tests\nthen ship")).toBe(true);
  });

  it("omits the time when the timestamp cannot be parsed", () => {
    expect(
      formatAuthoredMessageText({
        text: "hi",
        author: { id: "owner", name: "mike", kind: "human" },
        createdAt: "not a date",
      }),
    ).toBe("[mike]\nhi");
  });
});
