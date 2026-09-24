import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// A pairing link can be scoped to a single thread; the session paired from it
// inherits that scope. Nullable: ordinary links and sessions have no thread.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const pairingLinkColumns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(auth_pairing_links)
  `;
  if (!pairingLinkColumns.some((column) => column.name === "thread_id")) {
    yield* sql`
      ALTER TABLE auth_pairing_links
      ADD COLUMN thread_id TEXT
    `;
  }

  const sessionColumns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(auth_sessions)
  `;
  if (!sessionColumns.some((column) => column.name === "thread_id")) {
    yield* sql`
      ALTER TABLE auth_sessions
      ADD COLUMN thread_id TEXT
    `;
  }
});
