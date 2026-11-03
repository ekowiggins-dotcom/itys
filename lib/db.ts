import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
const globalDb = globalThis as unknown as { predictionDb?: Promise<PGlite> };
export function db() {
  return globalDb.predictionDb ??= (async () => {
    const dir = process.env.PREDICTION_DATA_DIR || path.join(process.cwd(), '.data/postgres');
    await mkdir(dir, { recursive: true });
    const database = new PGlite(dir);
    await database.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite TEXT UNIQUE NOT NULL, admin TEXT NOT NULL REFERENCES users(id), opens_at TIMESTAMPTZ);
      CREATE TABLE IF NOT EXISTS members (group_id TEXT REFERENCES groups(id), user_id TEXT REFERENCES users(id), PRIMARY KEY(group_id,user_id));
      CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id), creator TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, locks_at TIMESTAMPTZ NOT NULL);
      CREATE TABLE IF NOT EXISTS predictions (question_id TEXT REFERENCES questions(id), user_id TEXT REFERENCES users(id), answer TEXT NOT NULL CHECK(answer IN ('yes','no')), stake INTEGER NOT NULL CHECK(stake BETWEEN 5 AND 30 AND stake % 5 = 0), PRIMARY KEY(question_id,user_id));
    `);
    await database.exec('CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY)');
    for (const file of ['002-lifecycle.sql','003-judge-and-retries.sql','004-weekly-loop.sql','005-resolution-history.sql','006-notifications.sql','007-season-freezing.sql','008-football.sql','009-football-rankings.sql','010-moderation.sql','011-proposer.sql']) {
      const id=file.slice(0,3);
      if (!(await database.query('SELECT 1 FROM migrations WHERE id=$1',[id])).rows.length) {
        await database.transaction(async tx => {
          await tx.exec(await readFile(path.join(process.cwd(),'migrations',file),'utf8'));
          await tx.query('INSERT INTO migrations VALUES ($1)',[id]);
        });
      }
    }
    return database;
  })();
}
