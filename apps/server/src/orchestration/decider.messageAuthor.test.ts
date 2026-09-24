import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import {
  ApprovalRequestId,
  CommandId,
  EventId,
  MessageId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel, projectEvent } from "./projector.ts";

const createdAt = "2026-09-24T10:00:00.000Z";
const projectId = ProjectId.make("project-1");
const threadId = ThreadId.make("thread-authors");
const author = { id: "label:clay", name: "Clay", kind: "human" as const };

const readModelWithThread = Effect.gen(function* () {
  const withProject = yield* projectEvent(createEmptyReadModel(createdAt), {
    sequence: 1,
    eventId: EventId.make("event-project-created"),
    aggregateKind: "project",
    aggregateId: projectId,
    type: "project.created",
    occurredAt: createdAt,
    commandId: CommandId.make("command-project-created"),
    causationEventId: null,
    correlationId: CommandId.make("command-project-created"),
    metadata: {},
    payload: {
      projectId,
      title: "Project",
      workspaceRoot: "/tmp/project",
      defaultModelSelection: null,
      scripts: [],
      createdAt,
      updatedAt: createdAt,
    },
  });
  return yield* projectEvent(withProject, {
    sequence: 2,
    eventId: EventId.make("event-thread-created"),
    aggregateKind: "thread",
    aggregateId: threadId,
    type: "thread.created",
    occurredAt: createdAt,
    commandId: CommandId.make("command-thread-created"),
    causationEventId: null,
    correlationId: CommandId.make("command-thread-created"),
    metadata: {},
    payload: {
      threadId,
      projectId,
      title: "Shared thread",
      modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5" },
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt,
      updatedAt: createdAt,
    },
  });
});

const events = (planned: unknown) => (Array.isArray(planned) ? planned : [planned]);

it.layer(NodeServices.layer)("message authors", (it) => {
  it.effect("a turn start carries its stamped author onto the persisted user message", () =>
    Effect.gen(function* () {
      const readModel = yield* readModelWithThread;
      const planned = events(
        yield* decideOrchestrationCommand({
          readModel,
          command: {
            type: "thread.turn.start",
            commandId: CommandId.make("command-turn-start"),
            threadId,
            message: {
              messageId: MessageId.make("message-1"),
              role: "user",
              text: "Build it",
              attachments: [],
            },
            author,
            runtimeMode: "full-access",
            interactionMode: "default",
            createdAt,
          },
        }),
      );
      expect(planned.map((event) => event.type)).toEqual([
        "thread.message-sent",
        "thread.turn-start-requested",
      ]);
      expect(planned[0]?.payload).toMatchObject({ role: "user", author });

      const projected = yield* projectEvent(readModel, { ...planned[0]!, sequence: 3 });
      expect(projected.threads[0]?.messages[0]?.author).toEqual(author);
    }),
  );

  it.effect("a turn start without an author persists a message without the key", () =>
    Effect.gen(function* () {
      const readModel = yield* readModelWithThread;
      const planned = events(
        yield* decideOrchestrationCommand({
          readModel,
          command: {
            type: "thread.turn.start",
            commandId: CommandId.make("command-turn-start"),
            threadId,
            message: {
              messageId: MessageId.make("message-1"),
              role: "user",
              text: "Build it",
              attachments: [],
            },
            runtimeMode: "full-access",
            interactionMode: "default",
            createdAt,
          },
        }),
      );
      expect(planned[0]?.payload).not.toHaveProperty("author");
    }),
  );

  it.effect("a deferred append and an approval response record who acted", () =>
    Effect.gen(function* () {
      const readModel = yield* readModelWithThread;
      const appended = events(
        yield* decideOrchestrationCommand({
          readModel,
          command: {
            type: "thread.message.user.append",
            commandId: CommandId.make("command-append"),
            threadId,
            message: { messageId: MessageId.make("message-2"), text: "Later", attachments: [] },
            author,
            createdAt,
          },
        }),
      );
      expect(appended[0]?.payload).toMatchObject({ author });

      const approved = events(
        yield* decideOrchestrationCommand({
          readModel,
          command: {
            type: "thread.approval.respond",
            commandId: CommandId.make("command-approve"),
            threadId,
            requestId: ApprovalRequestId.make("approval-1"),
            decision: "accept",
            author,
            createdAt,
          },
        }),
      );
      expect(approved[0]?.type).toBe("thread.approval-response-requested");
      expect(approved[0]?.payload).toMatchObject({ author });
    }),
  );
});
