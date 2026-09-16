import { env } from "@/lib/runtime";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Database connection is unavailable. Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on Vercel."
    );
  }

  return drizzle(env.DB, { schema });
}
