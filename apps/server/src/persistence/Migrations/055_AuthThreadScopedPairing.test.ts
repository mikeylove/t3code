import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layer({ filename: ":memory:" })));

layer("055_AuthThreadScopedPairing", (it) => {
  it.effect("adds a nullable thread_id column to pairing links and sessions", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 54 });
      yield* runMigrations({ toMigrationInclusive: 55 });

      const pairingLinkColumns = yield* sql<{ readonly name: string; readonly notnull: number }>`
        PRAGMA table_info(auth_pairing_links)
      `;
      const sessionColumns = yield* sql<{ readonly name: string; readonly notnull: number }>`
        PRAGMA table_info(auth_sessions)
      `;
      const pairingLinkThreadId = pairingLinkColumns.find((column) => column.name === "thread_id");
      const sessionThreadId = sessionColumns.find((column) => column.name === "thread_id");

      assert.equal(pairingLinkThreadId?.name, "thread_id");
      assert.equal(pairingLinkThreadId?.notnull, 0);
      assert.equal(sessionThreadId?.name, "thread_id");
      assert.equal(sessionThreadId?.notnull, 0);
    }),
  );
});
