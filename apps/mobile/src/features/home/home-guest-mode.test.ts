import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { excludeGuestEnvironments, resolveHomeGuestMode } from "./home-guest-mode";

const owner = EnvironmentId.make("env-owner");
const guest = EnvironmentId.make("env-guest");
const otherGuest = EnvironmentId.make("env-guest-2");
const guestThread = ThreadId.make("thread-guest");
const otherGuestThread = ThreadId.make("thread-guest-2");
const guests = new Map([
  [guest, guestThread],
  [otherGuest, otherGuestThread],
]);

describe("resolveHomeGuestMode", () => {
  it("keeps owner chrome while any environment in scope is owned", () => {
    expect(
      resolveHomeGuestMode({
        selectedEnvironmentId: null,
        environmentIds: [owner, guest],
        guestThreadIds: guests,
      }),
    ).toEqual({ guestOnly: false, landingThread: null });
  });

  it("lands on the guest thread when the only environment is a guest session", () => {
    expect(
      resolveHomeGuestMode({
        selectedEnvironmentId: null,
        environmentIds: [guest],
        guestThreadIds: guests,
      }),
    ).toEqual({
      guestOnly: true,
      landingThread: { environmentId: guest, threadId: guestThread },
    });
  });

  it("follows the environment filter when it narrows to a guest environment", () => {
    expect(
      resolveHomeGuestMode({
        selectedEnvironmentId: guest,
        environmentIds: [owner, guest],
        guestThreadIds: guests,
      }),
    ).toEqual({
      guestOnly: true,
      landingThread: { environmentId: guest, threadId: guestThread },
    });
  });

  it("hides owner chrome but lists several guest threads without landing", () => {
    expect(
      resolveHomeGuestMode({
        selectedEnvironmentId: null,
        environmentIds: [guest, otherGuest],
        guestThreadIds: guests,
      }),
    ).toEqual({ guestOnly: true, landingThread: null });
  });

  it("treats an empty scope and unloaded sessions as owner mode", () => {
    expect(
      resolveHomeGuestMode({
        selectedEnvironmentId: null,
        environmentIds: [],
        guestThreadIds: guests,
      }),
    ).toEqual({ guestOnly: false, landingThread: null });
    expect(
      resolveHomeGuestMode({
        selectedEnvironmentId: null,
        environmentIds: [guest],
        guestThreadIds: new Map(),
      }),
    ).toEqual({ guestOnly: false, landingThread: null });
  });
});

describe("excludeGuestEnvironments", () => {
  it("drops guest environments from the searchable set and keeps the array otherwise", () => {
    const ids = [owner, guest];
    expect(excludeGuestEnvironments(ids, guests)).toEqual([owner]);
    expect(excludeGuestEnvironments(ids, new Map())).toBe(ids);
  });
});
