import { createClient } from '@supabase/supabase-js';
import type { User, Membership, Project } from './types.js';

export function createAuthServer(supabaseUrl: string, supabaseServiceKey: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return {
    // Verify JWT and get user
    async verifyToken(token: string): Promise<User | null> {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return null;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      return {
        id: user.id,
        email: user.email!,
        fullName: profile?.full_name || null,
        avatarUrl: profile?.avatar_url || null,
        createdAt: new Date(user.created_at),
      };
    },

    // Get user's membership for an org
    async getMembership(userId: string, orgId: string): Promise<Membership | null> {
      const { data, error } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        orgId: data.org_id,
        role: data.role,
        createdAt: new Date(data.created_at),
      };
    },

    // Check if user can access project
    async canAccessProject(userId: string, projectId: string): Promise<boolean> {
      const { data: project } = await supabase
        .from('projects')
        .select('org_id')
        .eq('id', projectId)
        .single();

      if (!project) return false;

      const membership = await this.getMembership(userId, project.org_id);
      return membership !== null;
    },

    // Get project by subdomain
    async getProjectBySubdomain(subdomain: string): Promise<Project | null> {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('subdomain', subdomain)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        orgId: data.org_id,
        name: data.name,
        slug: data.slug,
        subdomain: data.subdomain,
        githubRepo: data.github_repo,
        githubBranch: data.github_branch,
        lastDeployedAt: data.last_deployed_at ? new Date(data.last_deployed_at) : null,
        createdAt: new Date(data.created_at),
      };
    },

    // Create user profile (called after signup)
    async createUserProfile(userId: string, email: string, fullName?: string) {
      const { error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          full_name: fullName,
        });
      if (error) throw error;
    },

    // Audit logging
    async logAction(params: {
      orgId: string;
      userId: string | null;
      action: string;
      resourceType: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    }) {
      await supabase.from('audit_logs').insert({
        org_id: params.orgId,
        user_id: params.userId,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        metadata: params.metadata || {},
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });
    },

    // Raw supabase client
    supabase,
  };
}

export type AuthServer = ReturnType<typeof createAuthServer>;
