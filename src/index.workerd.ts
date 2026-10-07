import type { Kysely } from "kysely";
import { scopedConnection, type RegisteredDB } from "@/connection";

export { defineConfig, resolveEnvironment } from "@/config";
export { withConnection, type Register } from "@/connection";

export async function connection<DB = RegisteredDB>(): Promise<Kysely<DB>> {
  const scoped = scopedConnection<DB>();

  if (!scoped) {
    throw new Error(
      "connection() was called outside withConnection(). Wrap the request handler with withConnection().",
    );
  }

  return scoped;
}

export async function newConnection<DB = RegisteredDB>(): Promise<Kysely<DB>> {
  throw new Error("newConnection() is not supported on Cloudflare Workers. Use withConnection().");
}
