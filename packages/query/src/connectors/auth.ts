import type { PostgresConnection, MySQLConnection, SnowflakeConnection } from '@yamchart/schema';

export interface ResolvedCredentials {
  user: string;
  password: string;
}

export interface ResolvedSnowflakeCredentials {
  username: string;
  password?: string;
  privateKey?: string;
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

export function resolveMySQLAuth(connection: MySQLConnection): ResolvedCredentials {
  const auth = connection.auth;

  // Auth is optional for MySQL (local dev)
  if (!auth) {
    return {
      user: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASSWORD ?? '',
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

  throw new Error(`Auth type "${auth.type}" not yet implemented`);
}

export function resolveSnowflakeAuth(connection: SnowflakeConnection): ResolvedSnowflakeCredentials {
  const auth = connection.auth;

  if (auth.type === 'env') {
    const username = process.env[auth.user_var];
    const password = process.env[auth.password_var];

    if (!username) {
      throw new Error(`Missing environment variable: ${auth.user_var}`);
    }

    return { username, password: password ?? undefined };
  }

  if (auth.type === 'key_pair') {
    const username = process.env[auth.user_var];

    if (!username) {
      throw new Error(`Missing environment variable: ${auth.user_var}`);
    }

    // Read private key from file path
    const fs = require('fs');
    const privateKey = fs.readFileSync(auth.private_key_path, 'utf-8');

    return { username, privateKey };
  }

  throw new Error(`Auth type "${auth.type}" not yet implemented for Snowflake`);
}
