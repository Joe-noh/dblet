import { createDatabase } from "@/admin";
import { loadConfig } from "@/config";
import { createKysely } from "@/runtime";
import { createMigrator } from "./migration";

export default async function setup(): Promise<void> {
  const config = await loadConfig({ env: "test" });
  await createDatabase(config);

  const db = createKysely(config);

  try {
    const migrator = createMigrator(db, config);

    const { error } = await migrator.migrateToLatest();
    if (error) {
      throw error instanceof Error ? error.message : new Error(String(error));
    }
  } finally {
    await db.destroy();
  }
}
