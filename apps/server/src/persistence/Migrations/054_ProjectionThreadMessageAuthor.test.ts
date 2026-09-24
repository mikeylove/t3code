import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layer({ filename: ":memory:" })));

layer("054_ProjectionThreadMessageAuthor", (it) => {
  it.effect("accepts author added by an earlier development migration", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 53 });
      yield* sql`
        ALTER TABLE projection_thread_messages
        ADD COLUMN author_json TEXT
      `;

      yield* runMigrations({ toMigrationInclusive: 54 });

      const columns = yield* sql<{ readonly name: string; readonly notnull: number }>`
        PRAGMA table_info(projection_thread_messages)
      `;
      const author = columns.find((column) => column.name === "author_json");
      const migrations = yield* sql<{ readonly migration_id: number }>`
        SELECT migration_id
        FROM effect_sql_migrations
        WHERE migration_id = 54
      `;

      assert.equal(author?.name, "author_json");
      assert.equal(author?.notnull, 0);
      assert.equal(migrations.length, 1);
    }),
  );
});
