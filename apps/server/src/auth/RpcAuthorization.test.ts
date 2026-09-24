import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  AuthRelayReadScope,
  AuthRelayWriteScope,
  ORCHESTRATION_WS_METHODS,
  WS_METHODS,
  WsRpcGroup,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import {
  RPC_REQUIRED_SCOPES,
  RPC_THREAD_GUEST_ACCESS,
  THREAD_GUEST_COMMAND_TYPES,
  requiredScopeForRpcMethod,
  requiredScopeForDeviceList,
  threadGuestAccessForRpcMethod,
} from "./RpcAuthorization.ts";

describe("RPC authorization scopes", () => {
  it("declares exactly one scope for every RPC in the server group", () => {
    expect(new Set(Object.keys(RPC_REQUIRED_SCOPES))).toEqual(new Set(WsRpcGroup.requests.keys()));
  });

  it("authorizes background policy reporting and observation deliberately", () => {
    expect(requiredScopeForRpcMethod(WS_METHODS.serverReportClientActivity)).toBe(
      AuthOrchestrationReadScope,
    );
    expect(requiredScopeForRpcMethod(WS_METHODS.serverReportHostPowerState)).toBe(
      AuthOrchestrationOperateScope,
    );
    expect(requiredScopeForRpcMethod(WS_METHODS.serverGetBackgroundPolicy)).toBe(
      AuthOrchestrationReadScope,
    );
    expect(requiredScopeForRpcMethod(WS_METHODS.subscribeBackgroundPolicy)).toBe(
      AuthOrchestrationReadScope,
    );
  });

  it("allows relay status reads without granting relay installation access", () => {
    expect(requiredScopeForRpcMethod(WS_METHODS.cloudGetRelayClientStatus)).toBe(
      AuthRelayReadScope,
    );
    expect(requiredScopeForRpcMethod(WS_METHODS.cloudInstallRelayClient)).toBe(AuthRelayWriteScope);
  });

  it("requires permission to operate on a thread before uploading feedback", () => {
    expect(requiredScopeForRpcMethod(WS_METHODS.providerUploadFeedback)).toBe(
      AuthOrchestrationOperateScope,
    );
  });

  it("requires write access to import agent session history", () => {
    expect(requiredScopeForRpcMethod(WS_METHODS.agentSessionsScan)).toBe(
      AuthOrchestrationReadScope,
    );
    expect(requiredScopeForRpcMethod(WS_METHODS.agentSessionsImport)).toBe(
      AuthOrchestrationOperateScope,
    );
  });

  it("reads the reviewer menu under the same scope as the pull request it belongs to", () => {
    // The candidate list is a read like the detail beside it, and asking somebody for a review is
    // a write like every other pull request operation.
    expect(requiredScopeForRpcMethod(WS_METHODS.pullRequestsReviewerCandidates)).toBe(
      requiredScopeForRpcMethod(WS_METHODS.pullRequestsDetail),
    );
    expect(requiredScopeForRpcMethod(WS_METHODS.pullRequestsRequestReviewers)).toBe(
      requiredScopeForRpcMethod(WS_METHODS.pullRequestsComment),
    );
  });

  it("rejects unknown RPC method names", () => {
    for (const method of ["server.notRegistered", "toString", "constructor"]) {
      expect(() => requiredScopeForRpcMethod(method)).toThrow(
        `RPC method ${method} has no declared authorization scope.`,
      );
    }
  });
});

describe("thread guest access", () => {
  it("decides guest access for every RPC in the server group", () => {
    expect(new Set(Object.keys(RPC_THREAD_GUEST_ACCESS))).toEqual(
      new Set(WsRpcGroup.requests.keys()),
    );
  });

  it("confines guests to conversation on their own thread", () => {
    expect(threadGuestAccessForRpcMethod(ORCHESTRATION_WS_METHODS.dispatchCommand)).toBe("thread");
    expect(threadGuestAccessForRpcMethod(ORCHESTRATION_WS_METHODS.subscribeThread)).toBe("thread");
    expect(threadGuestAccessForRpcMethod(ORCHESTRATION_WS_METHODS.subscribeShell)).toBe("thread");
    expect(threadGuestAccessForRpcMethod(WS_METHODS.assetsCreateUrl)).toBe("thread");
    expect(THREAD_GUEST_COMMAND_TYPES.has("thread.turn.start")).toBe(true);
    expect(THREAD_GUEST_COMMAND_TYPES.has("thread.approval.respond")).toBe(true);
    expect(THREAD_GUEST_COMMAND_TYPES.has("thread.archive")).toBe(false);
    expect(THREAD_GUEST_COMMAND_TYPES.has("thread.delete")).toBe(false);
    expect(THREAD_GUEST_COMMAND_TYPES.has("thread.runtime-mode.set")).toBe(false);
  });

  it("denies guests everything that reaches the environment beyond their thread", () => {
    for (const method of [
      ORCHESTRATION_WS_METHODS.searchThreads,
      ORCHESTRATION_WS_METHODS.getArchivedShellSnapshot,
      WS_METHODS.serverGetSettings,
      WS_METHODS.projectsReadFile,
      WS_METHODS.filesystemBrowse,
      WS_METHODS.terminalOpen,
      WS_METHODS.subscribeTerminalEvents,
      WS_METHODS.vcsPull,
      WS_METHODS.pullRequestsList,
      WS_METHODS.previewOpen,
      WS_METHODS.deviceList,
      WS_METHODS.subscribeAuthAccess,
    ]) {
      expect(threadGuestAccessForRpcMethod(method)).toBe("denied");
    }
  });

  it("lets guests connect and render with environment-neutral reads only", () => {
    for (const method of [
      WS_METHODS.serverProbe,
      WS_METHODS.serverGetConfig,
      WS_METHODS.subscribeServerConfig,
      WS_METHODS.subscribeServerLifecycle,
      WS_METHODS.serverReportClientActivity,
    ]) {
      expect(threadGuestAccessForRpcMethod(method)).toBe("environment");
    }
  });

  it("rejects unknown RPC method names", () => {
    expect(() => threadGuestAccessForRpcMethod("server.notRegistered")).toThrow(
      "RPC method server.notRegistered has no declared thread guest access.",
    );
  });
});

it("requires operate permission for host retry while preserving read-only listing", () => {
  expect(requiredScopeForDeviceList({})).toBe(AuthOrchestrationReadScope);
  expect(requiredScopeForDeviceList({ retryHostId: "remote-host" })).toBe(
    AuthOrchestrationOperateScope,
  );
});

it("requires operate permission for tool updates even alongside a read-only check", () => {
  expect(requiredScopeForDeviceList({ updateTool: "agent", inspectOnly: true })).toBe(
    AuthOrchestrationOperateScope,
  );
  expect(requiredScopeForDeviceList({ updateTool: "hub" })).toBe(AuthOrchestrationOperateScope);
});
