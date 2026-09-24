import { AuthOrchestrationReadScope, EnvironmentHttpApi } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import {
  annotateEnvironmentRequest,
  failEnvironmentScopeRequired,
  requireEnvironmentScope,
} from "../auth/http.ts";
import * as PullRequestService from "./PullRequestService.ts";

/** The patch is often the largest PR payload and benefits from HTTP compression and flow control. */
export const pullRequestHttpApiLayer = HttpApiBuilder.group(
  EnvironmentHttpApi,
  "pullRequests",
  Effect.fnUntraced(function* (handlers) {
    const pullRequests = yield* PullRequestService.PullRequestService;
    return handlers.handle(
      "diff",
      Effect.fn("environment.pullRequests.diff")(function* (args) {
        yield* annotateEnvironmentRequest(args.endpoint.name);
        const session = yield* requireEnvironmentScope(AuthOrchestrationReadScope);
        // Pull requests are project-wide; a thread guest has no view of them.
        if (session.threadId !== undefined) {
          return yield* failEnvironmentScopeRequired(AuthOrchestrationReadScope);
        }
        return yield* pullRequests.diff(args.payload);
      }),
    );
  }),
);
