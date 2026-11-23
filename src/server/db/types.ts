import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Works with both the postgres-js driver (production) and PGlite (tests, zero-setup dev). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
/** A transaction handle has the same query API. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
