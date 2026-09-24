import {
  AuthAccessWriteScope,
  type AdvertisedEndpoint,
  type AuthEnvironmentScope,
} from "@t3tools/contracts";

import { isLoopbackHostname } from "~/environments/primary/target";
import { selectPairingEndpoint } from "./settings/ConnectionsSettings.logic";
import {
  resolveAdvertisedEndpointPairingUrl,
  resolveCurrentOriginPairingUrl,
} from "./settings/pairingUrls";

/**
 * Whether the client can mint a thread invite. Mirrors the Connections page:
 * pairing links are issued by the primary environment's HTTP API, so the
 * thread must live there and the session needs access:write (the desktop
 * shell always has it).
 */
export function canCreateThreadInvite(input: {
  readonly isPrimaryEnvironment: boolean;
  readonly isDesktopBridge: boolean;
  readonly sessionScopes: ReadonlyArray<AuthEnvironmentScope> | null;
  readonly localEnvironmentDisabled: boolean;
}): boolean {
  if (input.localEnvironmentDisabled || !input.isPrimaryEnvironment) return false;
  return input.isDesktopBridge || (input.sessionScopes?.includes(AuthAccessWriteScope) ?? false);
}

export interface ThreadInviteLink {
  readonly url: string;
  /** False for loopback URLs: a QR of one makes the scanning device dial itself. */
  readonly qrShareable: boolean;
}

/**
 * The pairing URL to show for a freshly created invite. Uses the same endpoint
 * Connections would pick, falling back to the origin serving this client so a
 * loopback-only server still yields a link that works from another browser on
 * this machine.
 */
export function resolveThreadInviteLink(input: {
  readonly credential: string;
  readonly endpoints: ReadonlyArray<AdvertisedEndpoint>;
  readonly defaultEndpointKey: string | null;
  readonly currentHref: string;
}): ThreadInviteLink {
  const endpoint = selectPairingEndpoint(input.endpoints, input.defaultEndpointKey);
  const url = endpoint
    ? resolveAdvertisedEndpointPairingUrl(endpoint, input.credential)
    : resolveCurrentOriginPairingUrl(input.credential, input.currentHref);
  return { url, qrShareable: !isLoopbackUrl(url) };
}

function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}
