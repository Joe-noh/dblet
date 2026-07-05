import type { ControlledTransaction } from "kysely";
import { afterAll, afterEach, beforeEach } from "vitest";
import { clearTestConnection, closeDbConn, rawDbConn, setTestConnection } from "@/runtime";

let tx: ControlledTransaction<any> | undefined;

beforeEach(async () => {
  const db = await rawDbConn();
  tx = await db.startTransaction().execute();

  setTestConnection(tx);
});

afterEach(async () => {
  clearTestConnection();

  const current = tx;
  tx = undefined;

  if (current && !current.isCommitted && !current.isRolledBack) {
    await current.rollback().execute();
  }
});

afterAll(async () => {
  await closeDbConn();
});

export {};
