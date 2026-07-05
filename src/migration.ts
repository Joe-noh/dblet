import promises from "node:fs/promises";
import path from "node:path";
import { Kysely } from "kysely";
import { Migrator, FileMigrationProvider } from "kysely/migration";
import type { ResolvedDbletConfig } from "@/config";

export function createMigrator(db: Kysely<any>, config: ResolvedDbletConfig) {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs: promises,
      path,
      migrationFolder: config.migrations.directory,
    }),
  });
}

export function migrationTemplate(): string {
  return [
    `import { Kysely } from "dblet/kysely";`,
    ``,
    `export async function up(db: Kysely<any>): Promise<void> {`,
    `}`,
    ``,
    `export async function down(db: Kysely<any>): Promise<void> {`,
    `}`,
    ``,
  ].join("\n");
}

export function generateTimestamp(date = new Date()): string {
  const elems = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];

  return elems.map((n) => zeroPad(n)).join("");
}

function zeroPad(n: number) {
  if (n < 10) {
    return `0${n}`;
  } else {
    return `${n}`;
  }
}
