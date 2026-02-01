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
