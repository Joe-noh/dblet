import type { Kysely } from "kysely";
import { describe, expect, expectTypeOf, test } from "vitest";
import { renderTypes } from "@/codegen";
import { connection } from "@/runtime";
import type { DB } from "./fixtures/app/dblet";

describe("renderTypes", () => {
  test("imports kysely types through dblet and registers DB", () => {
    const rendered = renderTypes(
      'import type { ColumnType } from "kysely";\n\nexport interface DB {}\n',
    );

    expect(rendered).toContain('import type { ColumnType } from "dblet/kysely";');
    expect(rendered).not.toContain('from "kysely"');
    expect(rendered).toMatch(/declare module "dblet" \{\s+interface Register \{\s+db: DB;/);
  });
});

// Checked by `pnpm typecheck` against test/fixtures/app/dblet.d.ts; the functions are never called.
test("connection() is typed by the generated types", () => {
  const typed = async () => await connection();

  expectTypeOf(typed).returns.resolves.toEqualTypeOf<Kysely<DB>>();

  const query = async () => {
    const db = await connection();

    // @ts-expect-error `posts` is not in the generated DB.
    return db.selectFrom("posts");
  };

  expectTypeOf(query).toBeFunction();
});
