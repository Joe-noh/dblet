import { dbConn } from "dblet";
import { expect, test } from "vitest";

test("inserted rows are visible within the same test", async () => {
  const db = await dbConn();

  await db.insertInto("users").values({ name: "John" }).execute();
  const rows = await db.selectFrom("users").selectAll().execute();

  expect(rows.map((r) => r.name)).toEqual(["John"]);
});
