import type { AdvertisedEndpoint } from "@t3tools/contracts";
import {
  AuthAdministrativeScopes,
  AuthStandardClientScopes,
  MAX_PAIRING_CREDENTIAL_TTL_MINUTES,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  canCreateThreadInvite,
  DEFAULT_THREAD_INVITE_TTL,
  isThreadInviteTtlOption,
  resolveThreadInviteLink,
  THREAD_INVITE_TTL_OPTIONS,
  threadInviteTtlMinutes,
} from "./ThreadInviteDialog.logic";

const lanEndpoint: AdvertisedEndpoint = {
  id: "desktop-lan:1",
  label: "LAN",
  provider: { id: "desktop-core", label: "Desktop", kind: "core", isAddon: false },
  httpBaseUrl: "http://192.168.1.20:3210",
  wsBaseUrl: "ws://192.168.1.20:3210",
  reachability: "lan",
  compatibility: { hostedHttpsApp: "mixed-content-blocked", desktopApp: "compatible" },
  source: "desktop-core",
  status: "available",
  isDefault: true,
};

describe("canCreateThreadInvite", () => {
  const base = {
    isPrimaryEnvironment: true,
    isDesktopBridge: false,
    sessionScopes: AuthAdministrativeScopes,
    localEnvironmentDisabled: false,
  };

  it("allows a primary-environment thread with access:write", () => {
    expect(canCreateThreadInvite(base)).toBe(true);
  });

  it("hides the action for standard-scope sessions", () => {
    expect(canCreateThreadInvite({ ...base, sessionScopes: AuthStandardClientScopes })).toBe(false);
    expect(canCreateThreadInvite({ ...base, sessionScopes: null })).toBe(false);
  });

  it("trusts the desktop shell regardless of session scopes", () => {
    expect(canCreateThreadInvite({ ...base, isDesktopBridge: true, sessionScopes: null })).toBe(
      true,
    );
  });

  it("never offers invites for remote environments or a disabled local environment", () => {
    expect(canCreateThreadInvite({ ...base, isPrimaryEnvironment: false })).toBe(false);
    expect(canCreateThreadInvite({ ...base, localEnvironmentDisabled: true })).toBe(false);
  });
});

describe("resolveThreadInviteLink", () => {
  it("encodes the token against the selected advertised endpoint", () => {
    const link = resolveThreadInviteLink({
      credential: "tok",
      endpoints: [lanEndpoint],
      defaultEndpointKey: null,
      currentHref: "http://localhost:3000/threads/abc",
    });
    expect(link.url.startsWith("http://192.168.1.20:3210/pair")).toBe(true);
    expect(link.url).toContain("tok");
    expect(link.qrShareable).toBe(true);
  });

  it("falls back to the current origin and disables the QR on loopback", () => {
    const link = resolveThreadInviteLink({
      credential: "tok",
      endpoints: [],
      defaultEndpointKey: null,
      currentHref: "http://localhost:3000/threads/abc",
    });
    expect(link.url.startsWith("http://localhost:3000/pair")).toBe(true);
    expect(link.qrShareable).toBe(false);
  });

  it("keeps the QR when the current origin is reachable from other devices", () => {
    const link = resolveThreadInviteLink({
      credential: "tok",
      endpoints: [],
      defaultEndpointKey: null,
      currentHref: "http://mac.tailnet.ts.net:3000/",
    });
    expect(link.qrShareable).toBe(true);
  });
});

describe("threadInviteTtlMinutes", () => {
  it("maps each lifetime choice to whole minutes", () => {
    expect(threadInviteTtlMinutes("1h")).toBe(60);
    expect(threadInviteTtlMinutes("24h")).toBe(1440);
    expect(threadInviteTtlMinutes("7d")).toBe(10080);
  });

  it("never exceeds the server maximum", () => {
    for (const option of THREAD_INVITE_TTL_OPTIONS) {
      const minutes = threadInviteTtlMinutes(option);
      expect(Number.isInteger(minutes)).toBe(true);
      expect(minutes).toBeGreaterThanOrEqual(1);
      expect(minutes).toBeLessThanOrEqual(MAX_PAIRING_CREDENTIAL_TTL_MINUTES);
    }
  });

  it("defaults to a day and rejects unknown values", () => {
    expect(DEFAULT_THREAD_INVITE_TTL).toBe("24h");
    expect(isThreadInviteTtlOption("24h")).toBe(true);
    expect(isThreadInviteTtlOption("forever")).toBe(false);
  });
});
