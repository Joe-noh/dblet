import { defineConfig } from "dblet";

export default defineConfig({
  db: {
    client: "pg",
    development: {
      connection: {
        host: "localhost",
        port: 54321,
        user: "dblet",
        password: "dblet",
        database: "dblet_e2e_dev",
      },
    },
    test: {
      connection: {
        host: "localhost",
        port: 54321,
        user: "dblet",
        password: "dblet",
        database: "dblet_e2e_test",
      },
    },
  },
});
