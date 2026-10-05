# dblet

## Install

```sh
npm install dblet
```

## Config

```ts
// dblet.config.ts
import { defineConfig } from "dblet";

export default defineConfig({
  db: {
    client: "pg",
    environments: {
      development: {
        connection: {
          host: "localhost",
          port: 5432,
          user: "postgres",
          password: "postgres",
          database: "myapp_dev",
        },
      },
      test: {
        connection: {
          host: "localhost",
          port: 5432,
          user: "postgres",
          password: "postgres",
          database: "myapp_test",
        },
      },
      production: {
        connection: {
          host: process.env.PGHOST,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: "myapp",
        },
        poolSize: 10,
      },
    },
  },
  migrations: { directory: "migrations" }, // optional
});
```

## CLI

```sh
npx dblet migration:new create_users
npx dblet migration:up
npx dblet migration:down
npx dblet migration:status

npx dblet db:create
npx dblet db:drop
npx dblet db:reset

# Environment: --env > DBLET_ENV > "development"
npx dblet migration:up --env=production
DBLET_ENV=production npx dblet migration:up
```

## Migration

```ts
// migrations/20260705000000_create_users.ts
import { Kysely, sql } from "dblet/kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.defaultTo(sql`now()`).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("users").execute();
}
```

## Query

```ts
import { connection } from "dblet";

const db = await connection();
const users = await db.selectFrom("users").selectAll().execute();
```

```sh
DBLET_ENV=production node server.js
```

## Vitest

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["dblet/vitest-global"], // creates and migrates the test database
    setupFiles: ["dblet/vitest"], // runs each test in a transaction and rolls it back
  },
});
```

## Cloudflare Workers

```ts
import { connection, resolveEnvironment, withConnection } from "dblet";
import config from "../dblet.config";

export default {
  fetch(req: Request, env: Env) {
    return withConnection(resolveEnvironment(config, env.DBLET_ENV), async () => {
      const db = await connection();
      const users = await db.selectFrom("users").selectAll().execute();

      return Response.json(users);
    });
  },
};
```

```ts
// With Hyperdrive
withConnection(
  {
    connection: {
      host: env.HYPERDRIVE.host,
      port: env.HYPERDRIVE.port,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
    },
  },
  handler,
);
```

```toml
# wrangler.toml
compatibility_flags = ["nodejs_compat"]

[vars]
DBLET_ENV = "production"
```
