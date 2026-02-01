import { createClient } from '@supabase/supabase-js';
import type { User, Org, Session, Membership } from './types.js';

export function createAuthClient(supabaseUrl: string, supabaseAnonKey: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  return {
    // Auth methods
    async signUp(email: string, password: string, fullName: string) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) throw error;
      return data;
    },

    async signIn(email: string, password: string) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },

    async signInWithOAuth(provider: 'google' | 'github') {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      return data;
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    async getSession(): Promise<Session | null> {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      // Get user's orgs with roles
      const { data: memberships } = await supabase
        .from('memberships')
        .select(`
          role,
          org:orgs(*)
        `)
        .eq('user_id', user.id);

      const orgs = (memberships || []).map((m: { role: string; org: Org }) => ({
        ...m.org,
        role: m.role as Membership['role'],
      }));

      // Get current org from localStorage or first org
      const currentOrgId = typeof window !== 'undefined'
        ? localStorage.getItem('currentOrgId')
        : null;
      const currentOrg = orgs.find((o) => o.id === currentOrgId) || orgs[0] || null;
      const currentRole = currentOrg
        ? orgs.find((o) => o.id === currentOrg.id)?.role || null
        : null;

      return {
        user: {
          id: user.id,
          email: user.email!,
          fullName: profile?.full_name || null,
          avatarUrl: profile?.avatar_url || null,
          createdAt: new Date(user.created_at),
        },
        orgs,
        currentOrg,
        currentRole,
      };
    },

    async switchOrg(orgId: string) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('currentOrgId', orgId);
      }
    },

    // Org methods
    async createOrg(name: string, slug: string) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create org
      const { data: org, error: orgError } = await supabase
        .from('orgs')
        .insert({ name, slug })
        .select()
        .single();
      if (orgError) throw orgError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('memberships')
        .insert({
          user_id: user.id,
          org_id: org.id,
          role: 'owner',
        });
      if (memberError) throw memberError;

      return org as Org;
    },

    async updateOrg(orgId: string, updates: Partial<Pick<Org, 'name' | 'logoUrl'>>) {
      const { data, error } = await supabase
        .from('orgs')
        .update({
          name: updates.name,
          logo_url: updates.logoUrl,
        })
        .eq('id', orgId)
        .select()
        .single();
      if (error) throw error;
      return data as Org;
    },

    // Invitation methods
    async inviteUser(orgId: string, email: string, role: Membership['role']) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          org_id: orgId,
          email,
          role,
          invited_by: user.id,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      return { ...data, token } as { token: string };
    },

    async acceptInvitation(token: string) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get invitation
      const { data: invitation, error: invError } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .is('accepted_at', null)
        .single();
      if (invError) throw invError;

      // Check expiration
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('Invitation expired');
      }

      // Create membership
      const { error: memberError } = await supabase
        .from('memberships')
        .insert({
          user_id: user.id,
          org_id: invitation.org_id,
          role: invitation.role,
        });
      if (memberError) throw memberError;

      // Mark invitation as accepted
      await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return invitation;
    },

    // Subscribe to auth changes
    onAuthStateChange(callback: (user: User | null) => void) {
      return supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          callback({
            id: session.user.id,
            email: session.user.email!,
            fullName: profile?.full_name || null,
            avatarUrl: profile?.avatar_url || null,
            createdAt: new Date(session.user.created_at),
          });
        } else {
          callback(null);
        }
      });
    },

    // Raw supabase client for advanced queries
    supabase,
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
