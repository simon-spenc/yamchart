import type { FastifyRequest, FastifyReply } from 'fastify';
import { createAuthServer, type AuthServer } from '@dashbook/auth/server';

let authServer: AuthServer | null = null;

export function initAuthServer(supabaseUrl: string, supabaseServiceKey: string) {
  authServer = createAuthServer(supabaseUrl, supabaseServiceKey);
  return authServer;
}

export function getAuthServer(): AuthServer {
  if (!authServer) {
    throw new Error('Auth server not initialized');
  }
  return authServer;
}

// Fastify decorator to add user to request
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
    };
    orgId?: string;
  }
}

// Auth middleware - validates JWT
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const user = await getAuthServer().verifyToken(token);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    request.user = { id: user.id, email: user.email };
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

// Org middleware - checks user has access to org
export async function orgMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const orgId = request.headers['x-org-id'] as string;

  if (!orgId) {
    return reply.status(400).send({ error: 'Missing X-Org-Id header' });
  }

  if (!request.user) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  const membership = await getAuthServer().getMembership(request.user.id, orgId);
  if (!membership) {
    return reply.status(403).send({ error: 'Not a member of this organization' });
  }

  request.orgId = orgId;
}

// Role check helper
export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.orgId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const membership = await getAuthServer().getMembership(request.user.id, request.orgId);
    if (!membership || !roles.includes(membership.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
