import path from 'node:path';

/** Where the embedded database lives.
 * 1. PREDICTION_DATA_DIR if set explicitly.
 * 2. On Railway, inside the attached volume (Railway sets RAILWAY_VOLUME_MOUNT_PATH).
 * 3. Otherwise a local .data folder, which is fine for development only. */
export function storage(env: Record<string, string | undefined> = process.env) {
  if (env.PREDICTION_DATA_DIR) return { dir: env.PREDICTION_DATA_DIR, persistent: true, source: 'PREDICTION_DATA_DIR' as const };
  if (env.RAILWAY_VOLUME_MOUNT_PATH) return { dir: path.join(env.RAILWAY_VOLUME_MOUNT_PATH, 'postgres'), persistent: true, source: 'railway-volume' as const };
  const production = env.NODE_ENV === 'production';
  return { dir: path.join(process.cwd(), '.data/postgres'), persistent: !production, source: 'local' as const };
}
