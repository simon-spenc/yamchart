import type { PostgresConnection } from '@dashbook/schema';

export interface ResolvedCredentials {
  user: string;
  password: string;
}

export function resolvePostgresAuth(connection: PostgresConnection): ResolvedCredentials {
  const auth = connection.auth;

  // Auth is optional for Postgres (local dev with trust auth)
  if (!auth) {
    return {
      user: process.env.PGUSER ?? 'postgres',
      password: process.env.PGPASSWORD ?? '',
    };
  }

  if (auth.type === 'env') {
    const user = process.env[auth.user_var];
    const password = process.env[auth.password_var];

    if (!user) {
      throw new Error(`Missing environment variable: ${auth.user_var}`);
    }

    return { user, password: password ?? '' };
  }

  // key_pair and secret_manager deferred to post-MVP
  throw new Error(`Auth type "${auth.type}" not yet implemented`);
}
