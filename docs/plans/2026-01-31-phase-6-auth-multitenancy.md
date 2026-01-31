# Dashbook Phase 6: Auth & Multi-tenancy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add authentication, organization management, and billing to enable Dashbook as a multi-tenant SaaS platform.

**Architecture:** Supabase provides auth (email, OAuth, magic links) and PostgreSQL for the control plane (orgs, users, projects). Stripe handles flat-tier subscriptions. Each org connects their GitHub repo; dashboards are isolated per-org.

**Tech Stack:** Supabase (Auth + PostgreSQL), Stripe, GitHub App API

**Prerequisites:** Phase 0-5 complete (full MVP with deployment)

---

## Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase PostgreSQL                       │
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │    users     │      │    orgs      │      │   projects   │   │
│  │──────────────│      │──────────────│      │──────────────│   │
│  │ id (uuid)    │      │ id (uuid)    │      │ id (uuid)    │   │
│  │ email        │      │ name         │      │ org_id (fk)  │   │
│  │ full_name    │      │ slug         │      │ name         │   │
│  │ avatar_url   │      │ plan         │      │ github_repo  │   │
│  │ created_at   │      │ stripe_id    │      │ subdomain    │   │
│  └──────────────┘      │ created_at   │      │ config       │   │
│         │              └──────────────┘      │ created_at   │   │
│         │                     │              └──────────────┘   │
│         │                     │                     │           │
│         │    ┌────────────────┴─────────────┐      │           │
│         │    │                              │      │           │
│         ▼    ▼                              ▼      ▼           │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │   memberships    │              │   audit_logs     │        │
│  │──────────────────│              │──────────────────│        │
│  │ id (uuid)        │              │ id (uuid)        │        │
│  │ user_id (fk)     │              │ org_id (fk)      │        │
│  │ org_id (fk)      │              │ user_id (fk)     │        │
│  │ role             │              │ action           │        │
│  │ created_at       │              │ resource         │        │
│  └──────────────────┘              │ metadata         │        │
│                                    │ created_at       │        │
│                                    └──────────────────┘        │
└─────────────────────────────────────────────────────────────────┘

Roles: owner, admin, member, viewer
Plans: free, pro, enterprise
```

---

## Task 1: Setup Supabase Project

**Step 1: Create Supabase project**

1. Go to https://supabase.com/dashboard
2. Create new project "dashbook"
3. Note down:
   - Project URL: `https://xxx.supabase.co`
   - Anon key: `eyJ...`
   - Service role key: `eyJ...` (keep secret!)

**Step 2: Enable auth providers**

In Supabase Dashboard → Authentication → Providers:
- Enable Email (with confirm email)
- Enable Google OAuth
- Enable GitHub OAuth

**Step 3: Configure auth settings**

In Authentication → Settings:
- Site URL: `https://dashbook.fly.dev` (or your domain)
- Redirect URLs:
  - `https://dashbook.fly.dev/auth/callback`
  - `http://localhost:3000/auth/callback` (for dev)

**Step 4: Commit environment template**

Create `.env.example`:

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...

# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA..."
GITHUB_CLIENT_ID=Iv1.xxx
GITHUB_CLIENT_SECRET=xxx

# App
APP_URL=https://dashbook.fly.dev
```

```bash
git add .env.example
git commit -m "chore: add environment variables template"
```

---

## Task 2: Create Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(63) NOT NULL UNIQUE,
  plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization memberships
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- Projects (dashbook instances per org)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(63) NOT NULL,
  subdomain VARCHAR(63) UNIQUE,
  github_repo VARCHAR(255),
  github_installation_id BIGINT,
  github_branch VARCHAR(255) DEFAULT 'main',
  config JSONB DEFAULT '{}',
  last_deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, slug)
);

-- Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_org_id ON memberships(org_id);
CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_subdomain ON projects(subdomain);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orgs_updated_at
  BEFORE UPDATE ON orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Apply migration**

```bash
npx supabase db push
```

**Step 3: Commit**

```bash
mkdir -p supabase/migrations
git add supabase/
git commit -m "feat(db): add initial schema for orgs, users, projects"
```

---

## Task 3: Setup Row Level Security (RLS)

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

**Step 1: Create RLS policies**

Create `supabase/migrations/002_rls_policies.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is member of org
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.org_id = $1
    AND memberships.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check user's role in org
CREATE OR REPLACE FUNCTION get_org_role(org_id UUID)
RETURNS VARCHAR AS $$
BEGIN
  RETURN (
    SELECT role FROM memberships
    WHERE memberships.org_id = $1
    AND memberships.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is org admin or owner
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.org_id = $1
    AND memberships.user_id = auth.uid()
    AND memberships.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can view members of their orgs"
  ON users FOR SELECT
  USING (
    id IN (
      SELECT m2.user_id FROM memberships m1
      JOIN memberships m2 ON m1.org_id = m2.org_id
      WHERE m1.user_id = auth.uid()
    )
  );

-- Orgs policies
CREATE POLICY "Users can view orgs they belong to"
  ON orgs FOR SELECT
  USING (is_org_member(id));

CREATE POLICY "Admins can update their orgs"
  ON orgs FOR UPDATE
  USING (is_org_admin(id));

CREATE POLICY "Users can create orgs"
  ON orgs FOR INSERT
  WITH CHECK (true);

-- Memberships policies
CREATE POLICY "Users can view memberships of their orgs"
  ON memberships FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Admins can manage memberships"
  ON memberships FOR ALL
  USING (is_org_admin(org_id));

-- Projects policies
CREATE POLICY "Members can view projects"
  ON projects FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (is_org_admin(org_id));

-- Invitations policies
CREATE POLICY "Admins can manage invitations"
  ON invitations FOR ALL
  USING (is_org_admin(org_id));

CREATE POLICY "Invited users can view their invitation"
  ON invitations FOR SELECT
  USING (email = auth.jwt()->>'email');

-- Audit logs policies
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_org_admin(org_id));

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);
```

**Step 2: Apply migration**

```bash
npx supabase db push
```

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat(db): add Row Level Security policies"
```

---

## Task 4: Create Auth Package

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/src/index.ts`
- Create: `packages/auth/src/client.ts`
- Create: `packages/auth/src/server.ts`
- Create: `packages/auth/src/types.ts`

**Step 1: Create packages/auth/package.json**

```json
{
  "name": "@dashbook/auth",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "import": "./dist/client.js"
    },
    "./server": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.47.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create packages/auth/src/types.ts**

```typescript
export interface User {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  logoUrl: string | null;
  createdAt: Date;
}

export interface Membership {
  id: string;
  userId: string;
  orgId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: Date;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  subdomain: string | null;
  githubRepo: string | null;
  githubBranch: string;
  lastDeployedAt: Date | null;
  createdAt: Date;
}

export interface Session {
  user: User;
  orgs: Array<Org & { role: Membership['role'] }>;
  currentOrg: Org | null;
  currentRole: Membership['role'] | null;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: Membership['role'];
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
}
```

**Step 3: Create packages/auth/src/client.ts**

```typescript
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

      const orgs = (memberships || []).map((m: any) => ({
        ...m.org,
        role: m.role,
      }));

      // Get current org from localStorage or first org
      const currentOrgId = localStorage.getItem('currentOrgId');
      const currentOrg = orgs.find((o: Org) => o.id === currentOrgId) || orgs[0] || null;
      const currentRole = currentOrg
        ? orgs.find((o: Org & { role: string }) => o.id === currentOrg.id)?.role || null
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
      localStorage.setItem('currentOrgId', orgId);
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
```

**Step 4: Create packages/auth/src/server.ts**

```typescript
import { createClient } from '@supabase/supabase-js';
import type { User, Org, Membership, Project } from './types.js';

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
```

**Step 5: Create packages/auth/src/index.ts**

```typescript
export * from './types.js';
export { createAuthClient, type AuthClient } from './client.js';
export { createAuthServer, type AuthServer } from './server.js';
```

**Step 6: Create packages/auth/tsconfig.json**

```json
{
  "extends": "@dashbook/config/tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 7: Update pnpm-workspace.yaml**

Add auth package if not auto-detected.

**Step 8: Install and commit**

```bash
pnpm install
git add packages/auth/
git commit -m "feat(auth): add Supabase auth package with client and server"
```

---

## Task 5: Setup Stripe Billing

**Files:**
- Create: `packages/billing/package.json`
- Create: `packages/billing/src/index.ts`
- Create: `packages/billing/src/stripe.ts`

**Step 1: Create packages/billing/package.json**

```json
{
  "name": "@dashbook/billing",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "stripe": "^17.0.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create packages/billing/src/stripe.ts**

```typescript
import Stripe from 'stripe';

export interface BillingConfig {
  secretKey: string;
  webhookSecret: string;
  prices: {
    pro: string;
    enterprise: string;
  };
}

export interface CreateCheckoutParams {
  orgId: string;
  orgName: string;
  email: string;
  plan: 'pro' | 'enterprise';
  successUrl: string;
  cancelUrl: string;
}

export function createBillingService(config: BillingConfig) {
  const stripe = new Stripe(config.secretKey);

  return {
    // Create Stripe customer for org
    async createCustomer(orgId: string, email: string, name: string) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { orgId },
      });
      return customer;
    },

    // Create checkout session for subscription
    async createCheckoutSession(params: CreateCheckoutParams) {
      const priceId = params.plan === 'pro'
        ? config.prices.pro
        : config.prices.enterprise;

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: params.email,
        client_reference_id: params.orgId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          orgId: params.orgId,
          plan: params.plan,
        },
      });

      return session;
    },

    // Create billing portal session
    async createPortalSession(customerId: string, returnUrl: string) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return session;
    },

    // Handle webhook events
    async handleWebhook(body: string, signature: string) {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        config.webhookSecret
      );

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          return {
            type: 'subscription_created' as const,
            orgId: session.metadata?.orgId,
            customerId: session.customer as string,
            subscriptionId: session.subscription as string,
            plan: session.metadata?.plan as 'pro' | 'enterprise',
          };
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          return {
            type: 'subscription_updated' as const,
            customerId: subscription.customer as string,
            subscriptionId: subscription.id,
            status: subscription.status,
          };
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          return {
            type: 'subscription_cancelled' as const,
            customerId: subscription.customer as string,
            subscriptionId: subscription.id,
          };
        }

        default:
          return { type: 'unhandled' as const, eventType: event.type };
      }
    },

    // Get subscription status
    async getSubscription(subscriptionId: string) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    },

    // Cancel subscription
    async cancelSubscription(subscriptionId: string) {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return subscription;
    },

    stripe,
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
```

**Step 3: Create packages/billing/src/index.ts**

```typescript
export { createBillingService, type BillingService, type BillingConfig, type CreateCheckoutParams } from './stripe.js';
```

**Step 4: Create tsconfig.json**

```json
{
  "extends": "@dashbook/config/tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 5: Commit**

```bash
pnpm install
git add packages/billing/
git commit -m "feat(billing): add Stripe billing package with flat-tier subscriptions"
```

---

## Task 6: Add Auth to Web App

**Files:**
- Create: `apps/web/src/providers/AuthProvider.tsx`
- Create: `apps/web/src/hooks/useAuth.ts`
- Create: `apps/web/src/components/auth/LoginForm.tsx`
- Create: `apps/web/src/components/auth/SignupForm.tsx`
- Create: `apps/web/src/components/auth/OrgSwitcher.tsx`

**Step 1: Create apps/web/src/providers/AuthProvider.tsx**

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createAuthClient, type AuthClient, type Session } from '@dashbook/auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  client: AuthClient;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createAuthClient(supabaseUrl, supabaseAnonKey));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const session = await client.getSession();
    setSession(session);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    const { data: { subscription } } = client.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.unsubscribe();
  }, [client]);

  return (
    <AuthContext.Provider value={{ session, loading, client, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
```

**Step 2: Create apps/web/src/hooks/useAuth.ts**

```typescript
import { useAuthContext } from '../providers/AuthProvider';

export function useAuth() {
  const { session, loading, client, refresh } = useAuthContext();

  return {
    user: session?.user ?? null,
    orgs: session?.orgs ?? [],
    currentOrg: session?.currentOrg ?? null,
    currentRole: session?.currentRole ?? null,
    loading,
    isAuthenticated: !!session?.user,

    // Auth actions
    signIn: client.signIn.bind(client),
    signUp: client.signUp.bind(client),
    signInWithGoogle: () => client.signInWithOAuth('google'),
    signInWithGitHub: () => client.signInWithOAuth('github'),
    signOut: client.signOut.bind(client),

    // Org actions
    createOrg: client.createOrg.bind(client),
    switchOrg: async (orgId: string) => {
      await client.switchOrg(orgId);
      await refresh();
    },

    // Invitation actions
    inviteUser: client.inviteUser.bind(client),
    acceptInvitation: client.acceptInvitation.bind(client),

    // Refresh session
    refresh,
  };
}
```

**Step 3: Create apps/web/src/components/auth/LoginForm.tsx**

```typescript
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function LoginForm() {
  const { signIn, signInWithGoogle, signInWithGitHub } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">Sign in to Dashbook</h1>

      {/* OAuth buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={signInWithGitHub}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Continue with GitHub
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with email</span>
        </div>
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <a href="/signup" className="text-primary-600 hover:underline">
          Sign up
        </a>
      </p>
    </div>
  );
}
```

**Step 4: Create apps/web/src/components/auth/OrgSwitcher.tsx**

```typescript
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function OrgSwitcher() {
  const { orgs, currentOrg, switchOrg } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (orgs.length <= 1) {
    return (
      <span className="text-sm font-medium text-gray-700">
        {currentOrg?.name || 'No organization'}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        {currentOrg?.name}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  switchOrg(org.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                  org.id === currentOrg?.id ? 'bg-gray-50 font-medium' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{org.name}</span>
                  <span className="text-xs text-gray-500 capitalize">{org.role}</span>
                </div>
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <a
                href="/orgs/new"
                className="block px-4 py-2 text-sm text-primary-600 hover:bg-gray-50"
              >
                Create new organization
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add auth components and hooks"
```

---

## Task 7: Add Auth Middleware to Server

**Files:**
- Create: `apps/server/src/middleware/auth.ts`
- Update: `apps/server/src/server.ts`

**Step 1: Create apps/server/src/middleware/auth.ts**

```typescript
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
```

**Step 2: Update server.ts to use auth (optional per route)**

Add to route registration:

```typescript
// Protected routes example
fastify.register(async (protectedRoutes) => {
  protectedRoutes.addHook('preHandler', authMiddleware);
  protectedRoutes.addHook('preHandler', orgMiddleware);

  // Register protected chart routes here
  await protectedRoutes.register(chartRoutes, { configLoader, queryService });
});

// Public routes (health, etc)
fastify.get('/api/health', async () => ({
  status: 'ok',
  version: '0.1.0',
}));
```

**Step 3: Commit**

```bash
git add apps/server/src/
git commit -m "feat(server): add auth middleware with JWT verification"
```

---

## Task 8: Final Integration and Testing

**Step 1: Update environment variables on Fly.io**

```bash
fly secrets set \
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  STRIPE_SECRET_KEY=sk_... \
  STRIPE_WEBHOOK_SECRET=whsec_...
```

**Step 2: Run full test suite**

```bash
pnpm test
```

**Step 3: Deploy**

```bash
fly deploy
```

**Step 4: Commit final changes**

```bash
git add .
git commit -m "feat: complete auth and multi-tenancy setup"
git push origin main
```

---

## Summary

After completing these tasks, you will have:

1. **Supabase Integration**:
   - User authentication (email, Google, GitHub)
   - PostgreSQL database for control plane
   - Row Level Security for data isolation

2. **Multi-tenancy**:
   - Organizations with memberships
   - Role-based access (owner, admin, member, viewer)
   - Org switching in UI

3. **Billing**:
   - Stripe integration for flat-tier subscriptions
   - Checkout flow for upgrades
   - Billing portal for management

4. **Security**:
   - JWT verification middleware
   - Per-org data isolation
   - Audit logging

**Database tables:**
- `orgs` - Organizations
- `users` - User profiles
- `memberships` - Org membership with roles
- `projects` - Dashbook projects per org
- `invitations` - User invitations
- `audit_logs` - Activity tracking

**Pricing tiers:**
- Free: 1 project, 1 user
- Pro ($X/month): Unlimited projects, 10 users
- Enterprise: Custom
