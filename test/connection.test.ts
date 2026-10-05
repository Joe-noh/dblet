import { sql } from "kysely";
import { describe, expect, test } from "vitest";
import { clearTestConnection, createKysely, setTestConnection, withConnection } from "@/connection";
import * as workerd from "@/index.workerd";
import { connection } from "@/runtime";

const options = {
  connection: {
    host: "localhost",
    port: 54321,
    user: "dblet",
    password: "dblet",
    database: "postgres",
  },
  poolSize: 1,
};

async function backendPid(): Promise<number> {
  const { rows } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(
    await connection(),
  );

  return rows[0].pid;
}

describe("withConnection", () => {
  test("connection() returns the scoped connection", async () => {
    // No dblet.config in the repo root, so this only works through the scope.
    const database = await withConnection(options, async () => {
      const { rows } = await sql<{ db: string }>`select current_database() as db`.execute(
        await connection(),
      );

      return rows[0].db;
    });

    expect(database).toBe("postgres");
  });

  test("keeps concurrent scopes separate", async () => {
    const run = () =>
      withConnection(options, async () => {
        const first = await backendPid();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const second = await backendPid();

        return [first, second];
      });

    const [a, b] = await Promise.all([run(), run()]);

    expect(a[0]).toBe(a[1]);
    expect(b[0]).toBe(b[1]);
    expect(a[0]).not.toBe(b[0]);
  });

  test("destroys the connection after the scope", async () => {
    const db = await withConnection(options, async () => {
      const db = await connection();
      await sql`select 1`.execute(db);

      return db;
    });

    await expect(sql`select 1`.execute(db)).rejects.toThrow(/destroyed/);
  });

  test("prefers the test connection", async () => {
    const testConn = createKysely(options);
    setTestConnection(testConn);

    try {
      await withConnection(options, async () => {
        expect(await connection()).toBe(testConn);
      });
    } finally {
      clearTestConnection();
      await testConn.destroy();
    }
  });
});

describe("workerd entry", () => {
  test("connection() works only inside withConnection()", async () => {
    await expect(workerd.connection()).rejects.toThrow(/outside withConnection/);

    await workerd.withConnection(options, async () => {
      expect(await workerd.connection()).toBe(await connection());
    });
  });

  test("newConnection() is not supported", async () => {
    await expect(workerd.newConnection()).rejects.toThrow(/not supported/);
  });
});
